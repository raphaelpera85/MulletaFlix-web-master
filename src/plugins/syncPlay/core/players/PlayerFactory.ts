import GenericPlayer from './GenericPlayer';

type PlayerWrapperClass = typeof GenericPlayer & {
    type: string;
};

type PlayerWrapperInstance = InstanceType<typeof GenericPlayer>;

class PlayerFactory {
    private wrappers: Record<string, PlayerWrapperClass>;

    private DefaultWrapper: PlayerWrapperClass;

    constructor() {
        this.wrappers = {};
        this.DefaultWrapper = GenericPlayer;
    }

    registerWrapper(wrapperClass: PlayerWrapperClass): void {
        console.debug('SyncPlay WrapperFactory registerWrapper:', wrapperClass.type);
        this.wrappers[wrapperClass.type] = wrapperClass;
    }

    setDefaultWrapper(wrapperClass: PlayerWrapperClass): void {
        console.debug('SyncPlay WrapperFactory setDefaultWrapper:', wrapperClass.type);
        this.DefaultWrapper = wrapperClass;
    }

    getWrapper(player: any, syncPlayManager: any): PlayerWrapperInstance | null {
        if (!player) {
            console.debug('SyncPlay WrapperFactory getWrapper: using default wrapper.');
            return this.getDefaultWrapper(syncPlayManager);
        }

        const playerId = player.syncPlayWrapAs || player.id;

        console.debug('SyncPlay WrapperFactory getWrapper:', playerId);
        const Wrapper = this.wrappers[playerId];
        if (Wrapper) {
            return new Wrapper(player, syncPlayManager);
        }

        console.debug(`SyncPlay WrapperFactory getWrapper: unknown player ${playerId}, using default wrapper.`);
        return this.getDefaultWrapper(syncPlayManager);
    }

    getDefaultWrapper(syncPlayManager: any): PlayerWrapperInstance | null {
        if (this.DefaultWrapper) {
            return new this.DefaultWrapper(null as any, syncPlayManager);
        }

        return null;
    }
}

export default PlayerFactory;
