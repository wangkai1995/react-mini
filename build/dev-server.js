var path = require('path');
var express = require('express');
var app = express();
var webpack = require('webpack');
var config = require('./webpack.dev');

var app = express();
var compile = webpack(config);

var webpackDevOptions = {
    publicPath: config.output.publicPath,
    headers: {
        'Access-Control-Allow-Origin': '*',
    },
};

app.use(require('webpack-dev-middleware')(compile, webpackDevOptions));


app.get('*', function (reg, res) {
    res.sendFile(path.join(__dirname, '../dev/index.html'));
});


app.listen(9523, 'localhost', function (err) {
    if (err) {
        console.log(err);
        return;
    }
    console.log('Listening at http://localhost:9523');
});