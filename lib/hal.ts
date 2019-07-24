import { IHttpService } from './http-service';
import { HalStorage, IHalStorageOrigins, IHalStorageAliases } from './storage';
import { IResource, Resource } from './resource';
import { Observable, Subject, Subscription, interval } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

export interface IConfig {
    http: IHttpService;
    storage: Storage;
    prefix?: string;
    dumpInterval?: number;
    autoDump?: boolean;
    autoDumpDebounceTime?: number;
    enableCache?: boolean;
}

export class Hal {
    private static readonly DEFAULT_AUTO_DUMP_DEBOUNCE_TIME = 1000;
    private static _storage: HalStorage;
    private static _http: IHttpService;
    private static _itemsCache: {[key: string]: Resource<any>} = {};
    private static _enableCache: boolean = false;
    private static _autoDump: boolean = true;
    private static _dump$: Subject<null> = new Subject<null>();
    private static _dumpTimer$: Observable<number>|null = null;
    private static _dumpTimer: Subscription|null = null;
    
    static init(config: IConfig) {
        Hal._dump$.pipe(debounceTime(config.autoDumpDebounceTime ? config.autoDumpDebounceTime : Hal.DEFAULT_AUTO_DUMP_DEBOUNCE_TIME)).subscribe(() => Hal.dump());
        Hal._http = config.http;
        Hal._storage = new HalStorage({
            storage: config.storage, 
            prefix: config.prefix ? config.prefix : ''
        });

        if (config.enableCache) {
            Hal.enableCache();
        }

        if (config.dumpInterval) {
            this._initDumpTimer(config.dumpInterval);
        }

        if (config.autoDump !== undefined) {
            Hal.enableAutoDump(config.autoDump);
        }
    }

    static follow(url: string, options?: any, alias?: string) {
        const follow = new Promise<any>((resolve, reject) => {
            Hal
            ._http
            .get(url, options)
            .toPromise()
            .then(data => {
                if (alias) {
                    Hal._storage.attach(data._links.self.href, alias);
                }
                Hal._storage.attach(data._links.self.href, url);
                Hal._storage.attach(data._links.self.href, data._links.self.href);

                Hal.setItem(data._links.self.href, data);

                resolve(data);
            });
        });
        return follow;
    }

    static resolveEmbeddedName(name: string, rel: string) {
        return `${name}@${rel}`;
    }

    static resolveLinkName(name: string, rel: string) {
        return `${name}#${rel}`;
    }

    static getLink(resource: IResource, rel: string) {
        const link = resource._links[rel];
        if (link) {
            return link.href;
        }
        throw new Error(`Link '${rel}' not found.`);
    }

    static getEmbedded(resource: IResource, rel: string, defaultValue?: any) {
        if (!resource._embedded) {
            return defaultValue;
        }
        const embedded = resource._embedded[rel];
        if (embedded) {
            return embedded;
        }
        return defaultValue;
    }

    static resloveBaseUrl(url: string) {
        return url.split('?')[0];
    }

    static implementsIResource(object: any) {
        if ('object' !== typeof object) {
            return false;
        }
        if (!('_links' in object)) {
            return false;
        }
        if ('object' !== typeof object['_links'] || !('self' in object['_links'])) {
            return false;
        }
        if ('object' !== typeof object['_links']['self'] || !('href' in object['_links']['self'])) {
            return false;
        }
        if ('string' !== typeof object['_links']['self']['href']) {
            return false;
        }
        return true;
    }

    static get http() {
        return Hal._http;
    }

    static get storage() {
        return Hal._storage;
    }

    // Storage proxy methods

    static getOrigin(alias: string) {
        return Hal._storage.getOrigin(alias);
    }

    static getItem(origin: string) {
        return Hal._storage.getItem(origin);
    }
    static setItem(origin: string, data: IResource) {
        Hal._storage.setItem(origin, data);
        if (Hal._autoDump) {
            Hal._dump$.next();
        }
    }

    static removeItem(origin: string) {
        Hal._storage.removeItem(origin);
        if (Hal._autoDump) {
            Hal._dump$.next();
        }
    }

    static attach(origin: string, alias: string) {
        return Hal._storage.attach(origin, alias);
    }

    static detach(alias: string) {
        return Hal._storage.detach(alias);
    }

    static get origins(): IHalStorageOrigins {
        return Hal._storage.origins;
    }

    static get aliases(): IHalStorageAliases {
        return Hal._storage.aliases;
    }

    static aliasData$(alias: string): Observable<IResource> {
        return Hal._storage.aliasData$(alias);
    }

    static removeSiblings(url: string) {
        Object
            .keys(Hal.origins)
            .filter(origin => Hal.resloveBaseUrl(origin) === url)
            .forEach(origin => Hal.removeItem(origin) );
    }

    static clear() {
        Hal._removeDumpTimer();
        Hal._storage.clear();
    }

    static dump() {
        Hal._storage.dump();
    }

    static hasCache(alias: string) {
        return Hal._enableCache && alias in Hal._itemsCache;
    }

    static getCache(alias: string) {
        if (Hal.hasCache(alias)) {
            return Hal._itemsCache[alias];
        }
        return null;
    }

    static setCache(alias: string, item: Resource<any>) {
        if (Hal._enableCache) {
            Hal._itemsCache[alias] = item;
        }
    }

    static removeCache(alias: string) {
        if (Hal._enableCache && Hal.hasCache(alias)) {
            delete Hal._itemsCache[alias];
        }
    }

    static clearCache() {
        if (Hal._enableCache) {
            Hal._itemsCache = {};
        }
    }

    static enableCache(enable: boolean = true) {
        Hal._enableCache = enable;
    }

    static enableAutoDump(enable: boolean = true) {
        Hal._autoDump = enable;
    }

    private static _initDumpTimer(dumpInterval: number) {
        Hal._dumpTimer$ = interval(dumpInterval);
        Hal._dumpTimer = Hal._dumpTimer$.subscribe(time => {
            Hal._dump$.next();
        });
    }

    private static _removeDumpTimer() {
        if (this._dumpTimer) {
            this._dumpTimer.unsubscribe();
        }
        this._dumpTimer = null;
        this._dumpTimer$ = null;
    }

    static get dumpTimer$() {
        return Hal._dumpTimer$;
    }

    static get dump$() {
        return Hal._dump$;
    }
}
