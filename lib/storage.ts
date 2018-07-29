import {  Subject, Observable } from "rxjs";
import { IResource } from "./resource";
import 'rxjs/add/operator/filter';
import { timer } from 'rxjs';
import { filter, map } from 'rxjs/operators'
import { Hal } from "./hal";

export interface IHalStorageConfig {
    storage: Storage;
    prefix: string;
    dumpInterval: number;
}

export interface IHalStorageAliases {
    [key: string]: string
}

export interface IHalStorageOrigins {
    [key: string]: IResource
}

export class HalStorageEvent {
    private _key: string;
    private _data: IResource;

    constructor(key: string, data: IResource) {
        this._key = key;
        this._data = data;
    }

    get key() {
        return this._key;
    }

    get data() {
        return this._data;
    }
}

export class HalStorage {
    private _data$: Subject<HalStorageEvent> = new Subject<HalStorageEvent>();
    private _aliasData$: Subject<HalStorageEvent> = new Subject<HalStorageEvent>();
    private _storage: Storage;
    private _aliases: IHalStorageAliases;
    private _origins: IHalStorageOrigins;
    private _prefix: string;
    private _dumpTimer: Observable<number>;

    constructor(config: IHalStorageConfig) {
        this._storage = config.storage;
        this._prefix = config.prefix;
        this._dumpTimer = timer(config.dumpInterval);

        const aliases = this._storage.getItem(this.aliasesKey);
        this._aliases = aliases ? JSON.parse(aliases) : {};

        const origins = this._storage.getItem(this.originsKey);
        this._origins = origins ? JSON.parse(origins) : {};

        this._dumpTimer.subscribe(time => {
            this._storage.setItem(this.originsKey, JSON.stringify(this._origins));
            this._storage.setItem(this.aliasesKey, JSON.stringify(this._aliases));
        });

        this._data$.subscribe(event => {
            this._origins[event.key] = event.data;
            this.getAliases(event.key).forEach(alias => {
                this._aliasData$.next(new HalStorageEvent(alias, event.data));
            });
        });
    }

    get originsKey() {
        return `${this._prefix}origins`;
    }

    get aliasesKey() {
        return `${this._prefix}aliases`;
    }

    aliasData$(alias: string): Observable<IResource> {
        return this
            ._aliasData$
            .pipe(
                filter(event => event.key === alias),
                map(event => event.data)
            )
    }

    get length() {
        return this._storage.length;
    }

    clear() {
        this._aliases = {};
        this._origins = {};
        this._storage.removeItem(this.originsKey);
        this._storage.removeItem(this.aliasesKey);
    }

    getItem(origin: string): IResource | null {
        if (origin in this._origins) {
            return this._origins[origin];
        } else {
            const originsData = this._storage.getItem(this.originsKey);
            if (originsData) {
                const origins = JSON.parse(originsData);
                if (origin in origins) {
                    return this._origins[origin] = origins[origin];
                } else {
                    return null;
                }
            } else {
                return null;
            }
        }
    }

    removeItem(origin: string): void {
        if (origin in this._origins) {
            delete this._origins[origin];
        }
    }

    setItem(origin: string, data: IResource): void {
        this._data$.next(new HalStorageEvent(origin, data));

        HalStorage
            .resolveEmbeddedResources(data)
            .forEach(embedded => {
                this.attach(embedded.data._links.self.href, Hal.resolveEmbeddedName(origin, embedded.key));
                this.getAliases(origin).forEach(alias => {
                    this.attach(embedded.data._links.self.href, Hal.resolveEmbeddedName(alias, embedded.key));
                });
                this.setItem(embedded.data._links.self.href, embedded.data);
            });
    }
    
    getOrigin(alias: string) {
        return this._aliases[alias];
    }

    attach(origin: string, alias: string) {
        this._aliases[alias] = origin;
    }

    detach(alias: string) {
        delete this._aliases[alias];
    }

    getAliases(origin: string): string[] {
        return Object
            .keys(this.aliases)
            .filter(alias => this.aliases[alias] === origin)
    } 

    static resolveEmbeddedResources(data: IResource): {key: string; data: IResource}[] {
        if (!data._embedded) {
            return [];
        }

        let embedded = data._embedded;
        return Object
                .keys(embedded)
                .map(key => {
                    return {key: key, data: embedded[key]};
                })
                .filter(item => Hal.implementsIResource(item.data));
    }

    get aliases(): IHalStorageAliases {
        return this._aliases;
    }

    get origins(): IHalStorageOrigins {
        return this._origins;
    }
}