module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            'react-native-worklets/plugin', // sau 'react-native-reanimated/plugin' dacă e versiune veche
        ],
    };
};