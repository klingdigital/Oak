﻿using System;
using System.Collections.Generic;
using System.Configuration;
using System.Diagnostics;
using System.Linq;
using System.Linq.Expressions;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web;
using System.Web.Http;
using Oak.Domain.Models;
using Oak.Domain.Services;
using Oak.UI.Web.Models.Api;
using static Oak.Domain.Models.DbGraph;

namespace Oak.UI.Web.Controllers.Api
{
    [RoutePrefix("api/schema")]
    public class SchemaController : ApiController
    {
        public SchemaController(int cacheTimeInMins, GraphService graphService)
        {
            this.cacheLife = TimeSpan.FromMinutes(cacheTimeInMins);
            this.graphService = graphService;
        }

        const string CACHEKEY = "graphCache";

        GraphService graphService;
        TimeSpan cacheLife;
        DbGraph cachedGraph
        {
            get
            {
                var cachedValue = HttpContext.Current.Application[CACHEKEY] as DbGraph;
                if (cachedValue == null)
                    return null;

                // Test cache expiry
                // If expired, return null - signalling to program cache is empty and value will be updated
                if ((cachedValue.CapturedUtc + cacheLife) < DateTime.UtcNow)
                    return null;

                return cachedValue;
            }
            set
            {
                HttpContext.Current.Application[CACHEKEY] = value;
            }
        }


        // GET api/schema/autocomplete
        [HttpGet]
        [Route("autocomplete")]
        public async Task<IHttpActionResult> GetAutocomplete(ObjectType? filter = null)
        {
            try
            {
                var graph = await getDbGraphAsync();

                var results = graph.Objects;

                // filter
                if (filter != null)
                    results = graph.Objects.Where(o => o.ObjectType == filter.Value).ToList();

                // map
                return Ok(results.Select(r => new AutocompleteResult
                {
                    Type = r.ObjectType,
                    Name = r.Name,
                    TypeName = r.ObjectType.ToString()
                }));
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        // GET api/schema/dependencytree/?objName={objName}&direction={direction}
        [HttpGet]
        [Route("dependencytree")]
        public async Task<IHttpActionResult> GetDependencyTree(string objName, int direction)
        {
            try
            {
                var callTree = new CallTreeData();

                // Validation - require query
                if (string.IsNullOrEmpty(objName))
                    return Ok(callTree);

                var graph = await getDbGraphAsync();

                // Get call tree from object if found
                var obj = graph.GetCallTree(objName, (CallTreeDirection)direction);
                if (obj != null && obj.Any())
                {
                    var dic = new Dictionary<string, string[]>();
                    buildDependencyDic(obj, dic);

                    foreach (var entry in dic)
                    {
                        // Add object entry
                        callTree.objects.Add(entry.Key, entry.Value);

                        // Add meta data entry for object
                        var item = graph.Objects.FirstOrDefault(o => o.Name == entry.Key);
                        if (item != null)
                            callTree.metadata.Add(entry.Key, new ObjectData { type = item.ObjectTypeKey });
                    }
                }

                return Ok(callTree);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        // GET api/schema/defintion/?objName={value}
        [HttpGet]
        [Route("definition")]
        public async Task<IHttpActionResult> GetDefinition(string objName)
        {
            try
            {
                //generate graph table
                var definition = new ObjectDefinition();

                if (string.IsNullOrEmpty(objName))
                    return Ok(definition);

                //get object definition from db
                definition.DefinitionText = await graphService.GetDefinition(objName);

                return Ok(definition);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        // GET api/schema/environments
        [HttpGet]
        [Route("environments")]
        public IHttpActionResult GetEnvironments()
        {
            try
            {
                var conns = getAllConnectionStringNames();
                return Ok(conns);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }


        async Task<DbGraph> getDbGraphAsync()
        {
            // Try get graph from cache
            var graph = cachedGraph;

            // Load graph if not cached
            if (graph == null)
            {
                graph = await graphService.GenerateDbObjectGraph();
                cachedGraph = graph; // cache
            }

            return graph;
        }

        void buildDependencyDic(List<DbObject> objs, Dictionary<string, string[]> dic)
        {
            foreach (var obj in objs)
                buildDependencyDic(obj, dic);
        }

        void buildDependencyDic(DbObject obj, Dictionary<string, string[]> dic)
        {
            Debug.WriteLine("Processing: " + obj.Name);

            if (dic.ContainsKey(obj.Name) == false)
                dic.Add(obj.Name, obj.DependsOn.Select(d => d.Name).ToArray());
            else
                return;

            foreach (var dependency in obj.DependsOn)
                buildDependencyDic(dependency, dic);

        }

        List<string> getAllConnectionStringNames()
        {
            var conns = new List<string>();

            // Capture names of all connection strings
            foreach (ConnectionStringSettings conn in ConfigurationManager.ConnectionStrings)
                conns.Add(conn.Name);

            return conns;
        }

        public class NodeResult
        {
            public string title { get; set; }
            public string label { get; set; }
        }
    }
}
