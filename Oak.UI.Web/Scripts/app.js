﻿//configuration
var autoCompleteDataUrl = "api/schema/autocomplete";
var callTreeDataUrlFormat = "api/schema/dependencytree/?objName={0}&direction={1}";
var definitionDataUrl = "api/schema/definition/?objName=";
var messageLabel = null;

var app = new Vue({
    el: '#app',
    data: {
        searchText: '',
        selectedWalkDirection: 0,
        selectedLayoutDirection: 'LR',
        message: '',
        showAutocomplete: false,
        filterShowProcs: true,    // typeId: 1
        filterShowTables: true,   // typeId: 2
        filterShowViews: true,    // typeId: 3
        filterShowFunctions: true, // typeId: 4
        autocompleteListFull: [],
        autocompleteListFiltered: [],
        currDefinitionText: '',
        maxItemsInAutocompleteList: 20
    },
    created: function () {

        // init graph
        graphComponent.init(this.loadDef, this.displayMessage);

        // init autocomplete
        this.loadAutocomplete();

        // refresh viewport
        graphComponent.updateSvgTransform();

    },
    watch: {
        searchText: function (val) {
            this.filterAutocomplete();
        },
        selectedLayoutDirection: function (val) {
            // update graph settings
            graphComponent.direction = val;
        },
        filterShowProcs: function (val) {
            this.filterAutocomplete();
        },
        filterShowTables: function (val) {
            this.filterAutocomplete();
        },
        filterShowViews: function (val) {
            this.filterAutocomplete();
        },
        filterShowFunctions: function (val) {
            this.filterAutocomplete();
        }
    },
    methods: {
        onSearchButtonClick: function () {
            this.showAutocomplete = false;
            this.search();
        },
        onSuggestionClick: function (objName) {
            this.searchText = objName;
            this.showAutocomplete = false;
        },
        onSearchFieldKeyUp: function (e) {
            // 13: enter
            if (e.keyCode === 13) {
                this.showAutocomplete = false;
                this.search();
            } else {
                if (!this.showAutocomplete)
                    this.showAutocomplete = true;
            }
        },
        search: function () {

            // needs at least 2 characters in box to search on
            // and direction must be selected
            if (this.searchText < 2 && !this.selectedWalkDirection) {
                return;
            }

            //build url with parameter
            var dataUrl = callTreeDataUrlFormat.replace("{0}", encodeURIComponent(this.searchText)).replace("{1}", this.selectedWalkDirection);
            console.log(dataUrl);

            try {
                this.displayMessage("Searching...");

                //get graph json
                $.getJSON(dataUrl)
                    .done(function (data) {
                        graphComponent.displayGraph(data, this.searchText);
                    })
                    .fail(function () {
                        this.displayMessage("A server error occurred when fetching tree data.");
                    });

            } catch (e) {
                this.displayMessage("A server error occurred when fetching tree data.");
                throw e;
            }

        },
        loadDef: function (objName) {

            //need at least 2 characters in box to search on
            if (objName.length < 2) {
                return;
            }

            //build url with parameter
            var dataUrl = definitionDataUrl + encodeURIComponent(objName);
            console.log(dataUrl);

            try {
                console.log("Getting definition data...");
                var me = this;

                //get graph json
                $.getJSON(dataUrl)
                    .done(function (data) {
                        //console.log(data);

                        me.currDefinitionText = data.DefinitionText;
                        console.log("Got definition");

                        //display definition
                        me.showDefinition("50%");

                    })
                    .fail(function () {

                        this.displayMessage("A server error occurred when fetching definition data.");

                        //display definition
                        me.currDefinitionText = "-- Sorry! The definition for this object could not be retrieved...";
                        me.showDefinition("50%");
                    });

            } catch (e) {
                this.displayMessage("A server error occurred when fetching definition data.");
                throw e;
            }
        },
        showDefinition: function (paneWidth) {

            //show panel
            var defPanel = $("#sp-definition-box");
            defPanel.css("width", paneWidth);
            defPanel.show(300);

            //display def
            var def = $("#sp-definition-box code");
            def.text(this.currDefinitionText);

            //apply highlighting
            $('pre code').each(function (i, block) {
                hljs.highlightBlock(block);
            });

        },
        resetDefinitionWindow: function () {

            //hide panel
            var defPanel = $("#sp-definition-box");
            defPanel.hide(100);

            //clear def
            var def = $("#sp-definition");
            def.text('');

        },
        loadAutocomplete: function () {

            var me = this;

            this.displayMessage("Loading autocomplete data...");

            $.getJSON(autoCompleteDataUrl)
                .done(function (data, status, xrh) {

                    console.log('autocomplete data', data, status);

                    me.autocompleteListFull = data;
                    me.autocompleteListFiltered = data;

                    try {
                        me.displayMessage(data.length + " database objects in schema");
                    }
                    catch (e) {
                        me.displayMessage("A server error occurred when fetching autocomplete data.");
                        throw e;
                    }

                }).fail(function () {
                    me.displayMessage("A server error occurred when fetching autocomplete data.");
                });
        },
        filterAutocomplete: function () {

            var matches = [];
            var substrRegex = new RegExp(this.searchText, 'i');
            var me = this;

            $.each(this.autocompleteListFull, function (i, item) {
                if (substrRegex.test(item.Name)) {
                    var isMatch = (me.filterShowProcs && item.Type === 1)
                        || (me.filterShowTables && item.Type === 2)
                        || (me.filterShowViews && item.Type === 3)
                        || (me.filterShowFunctions && item.Type === 4);
                    if (isMatch) {
                        matches.push(item);
                    }
                }
            });

            this.autocompleteListFiltered = matches.slice(0, this.maxItemsInAutocompleteList);
        },
        displayMessage: function (msg) {
            console.log(msg);
            this.message = msg;
        }
    }
});
