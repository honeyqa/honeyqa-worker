#!/usr/bin/env node

var java = require("java");
java.classpath.push("lucene-core-3.5.0.jar");

var idx = java.newInstanceSync("org.apache.lucene.store.RAMDirectory");
var version = java.getStaticFieldValue("org.apache.lucene.util.Version", "LUCENE_30");
var analyzer = java.newInstanceSync("org.apache.lucene.analysis.standard.StandardAnalyzer", version);
var writerConfig = java.newInstanceSync("org.apache.lucene.index.IndexWriterConfig", version, analyzer);
var writer = java.newInstanceSync("org.apache.lucene.index.IndexWriter", idx, writerConfig);
var queryParser = java.newInstanceSync("org.apache.lucene.queryParser.QueryParser", version, "content", analyzer);
