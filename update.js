import AutoGitUpdate from 'auto-git-update';

const config = {
    repository: 'https://github.com/alexjpbanks14/CBIDBTesting',
    fromReleases: false,
    tempLocation: '/var/tmp',
    ignoreFiles: [''],
    exitOnComplete: false
}

const updater = new AutoGitUpdate(config);

updater.autoUpdate();
