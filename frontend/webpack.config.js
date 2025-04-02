const path = require('path');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'WalletConnect', // Expose as a global variable
        libraryTarget: 'window', // Attach to window object
        globalObject: 'this' // Ensure compatibility in browser
    },
    mode: 'production',
    resolve: {
        fallback: {
            "buffer": require.resolve("buffer/"),
            "crypto": require.resolve("crypto-browserify"),
            "stream": require.resolve("stream-browserify"),
            "util": require.resolve("util/"),
            "events": require.resolve("events/")
        }
    }
};
