import AutoGitUpdate from 'auto-git-update';

const config = {
    repository: 'https://github.com/alexjpbanks14/CBIDBTesting',
    fromReleases: false,
    tempLocation: '/var/tmp',
    ignoreFiles: [''],
    executeOnComplete: '/root/CBIDBTesting/index.js',
    exitOnComplete: true
}

const updater = new AutoGitUpdate(config);

updater.autoUpdate();
