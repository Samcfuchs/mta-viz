"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//import * as express from 'express';
var express = require('express');
var sqlite3 = require("sqlite3");
var cors = require('cors');
var path = require('path');
var PATH = '../data/gtfs.db';
var app = express();
app.use(cors());
var port = 3000;
var db = new sqlite3.Database(PATH);
app.get('/stops', function (req, res) {
    db.all('SELECT * from stops', function (err, rows) {
        if (err)
            throw err;
        res.json(rows);
    });
});
app.get('/stops.txt', function (req, res) {
    res.sendFile(path.join(__dirname, '../data', 'stops.txt'));
});
app.get('/shapes.txt', function (req, res) {
    res.sendFile(path.join(__dirname, '../data', 'shapes.txt'));
});
app.get('/routes.txt', function (req, res) {
    res.sendFile(path.join(__dirname, '../data', 'routes.txt'));
});
app.get('/routes.json', function (req, res) {
    res.sendFile(path.join(__dirname, '../data', 'routes.json'));
});
app.get('/stop_times.txt', function (req, res) {
    res.sendFile(path.join(__dirname, '../data', 'stop_times.txt'));
});
app.get('/trips.txt', function (req, res) {
    res.sendFile(path.join(__dirname, '../data', 'trips.txt'));
});
app.listen(port, function () {
    console.log("Server running on port ".concat(port));
});
