import AutoGitUpdate from 'auto-git-update';

const config = {
    repository: 'https://github.com/alexjpbanks14/CBIDBTesting',
    fromReleases: true,
    tempLocation: '/var/tmp',
    ignoreFiles: ['util/config.js'],
    executeOnComplete: '/root/CBIDBTesting/index.js',
    exitOnComplete: true
}

const updater = new AutoGitUpdate(config);

updater.autoUpdate();
