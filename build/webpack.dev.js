var path = require('path');


module.exports = {
    mode: 'development',
    devtool: 'inline-source-map',
    //入口文件
    entry: path.resolve(__dirname, '../dev/index.tsx'),
    //输出文件
    output: {
        //文件命名
        filename: '[name].js',
        //输出目录
        publicPath: '/static/',
    },
    //监控文件
    module: {
        rules: [{
            //监听js
            test: /\.(js|mjs|jsx|ts|tsx)?$/,
            exclude: [
                path.resolve(__dirname, '../node_modules'),
            ],
            use: [{
                loader: require.resolve('babel-loader'),
                options: {
                    presets: [
                        require.resolve("@babel/preset-env"),
                        require.resolve("@babel/preset-react"),
                        require.resolve("@babel/preset-typescript")
                    ]
                }
            }]
        }]
    },
    resolve: {
        extensions: ['.js', '.ts', '.tsx', '.jsx'],
    },
    plugins: []
};