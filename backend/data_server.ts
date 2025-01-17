//import * as express from 'express';
const express = require('express');
import * as sqlite3 from 'sqlite3';
import { Path, ShapeUtils } from 'three';
const cors = require('cors');
const path = require('path');

const PATH = '../data/gtfs.db';

const app = express();
app.use(cors());
const port = 3000;

const db = new sqlite3.Database(PATH);

app.get('/stops', (req, res) => {
    db.all('SELECT * from stops', (err, rows) => {
        if (err) throw err;
        res.json(rows);
    });
});

app.get('/stops.txt', (req, res) => {
    res.sendFile(path.join(__dirname, '../data', 'stops.txt'))
})

app.get('/shapes.txt', (req, res) => {
    res.sendFile(path.join(__dirname, '../data', 'shapes.txt'))
})

app.get('/routes.txt', (req, res) => {
    res.sendFile(path.join(__dirname, '../data', 'routes.txt'))
})

app.get('/routes.json', (req, res) => {
    res.sendFile(path.join(__dirname, '../data', 'routes.json'))
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})