import {  Subject, Observable } from "rxjs";
import { IResource } from "./resource";
import 'rxjs/add/operator/filter';
import { filter, map } from 'rxjs/operators'
import { Hal } from "./hal";

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

    constructor(storage: Storage, prefix: string) {
        this._storage = storage;
        this._prefix = prefix;

        const aliases = this._storage.getItem(`${this._prefix}aliases`);
        this._aliases = aliases ? JSON.parse(aliases) : {};

        const origins = this._storage.getItem(`${this._prefix}origins`);
        this._origins = origins ? JSON.parse(origins) : {};

        this._data$.subscribe(event => {
            this._origins[event.key] = event.data;
            this._storage.setItem(`${this._prefix}origins`, JSON.stringify(this._origins));

            this.getAliases(event.key).forEach(alias => {
                this._aliasData$.next(new HalStorageEvent(alias, event.data));
            });
        });
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
        this._storage.clear();
    }

    getItem(origin: string): IResource | null {
        if (origin in this._origins) {
            return this._origins[origin];
        } else {
            const originsData = this._storage.getItem(`${this._prefix}origins`);
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
        this._storage.setItem(`${this._prefix}origins`, JSON.stringify(this._origins));
    }

    setItem(origin: string, data: IResource): void {
        this._data$.next(new HalStorageEvent(origin, data));

        HalStorage
            .resolveEmbeddedResources(data)
            .forEach(embedded => {
                this.attach(embedded.data._links.self.href, Hal.resolveEmbeddedName(origin, embedded.key));
                this.setItem(embedded.data._links.self.href, embedded.data);
            });
    }
    
    getOrigin(alias: string) {
        return this._aliases[alias];
    }

    attach(origin: string, alias: string) {
        this._aliases[alias] = origin;
        this._storage.setItem(`${this._prefix}aliases`, JSON.stringify(this._aliases));
    }

    detach(alias: string) {
        delete this._aliases[alias];
        this._storage.setItem(`${this._prefix}aliases`, JSON.stringify(this._aliases));
    }

    getAliases(origin: string): string[] {
        return Object
            .keys(this.aliases)
            .filter(alias => this.aliases[alias] === origin)
    } 

    private static resolveEmbeddedResources(data: IResource): {key: string; data: IResource}[] {
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