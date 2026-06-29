const { setWorldConstructor } = require('@cucumber/cucumber');

class SeleniumWorld {
    constructor() {
        this.driver = null;
        this.stageInfo = null;
        this.createdUsers = [];
        this.sharedUser = null;
        this.lastError = null;
    }
}

setWorldConstructor(SeleniumWorld);
