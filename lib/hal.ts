import { IHttpService } from './http-service';
import { HalStorage, IHalStorageOrigins } from './storage';
import { IResource } from './resource';
import { Observable } from 'rxjs';

export interface IConfig {
    http: IHttpService;
    storage: Storage;
    prefix?: string;
    dumpInterval?: number;
}

export class Hal {
    private static _storage: HalStorage;
    private static _http: IHttpService;

    static init(config: IConfig) {
        Hal._http = config.http;
        Hal._storage = new HalStorage({
            storage: config.storage, 
            prefix: config.prefix ? config.prefix : '',
            dumpInterval: config.dumpInterval ? config.dumpInterval : 5000, // 5 sec
        });
    }

    static follow(url: string, options?: any, alias?: string) {
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

                Hal._storage.setItem(data._links.self.href, data);
            });
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

    static getEmbedded(resource: IResource, rel: string, defaultValue: any) {
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

    // Storage proxy methods

    static getOrigin(alias: string) {
        return Hal._storage.getOrigin(alias);
    }

    static getItem(origin: string) {
        return Hal._storage.getItem(origin);
    }
    static setItem(origin: string, data: IResource) {
        Hal._storage.setItem(origin, data);
    }

    static removeItem(origin: string) {
        Hal._storage.removeItem(origin);
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

    static aliasData$(alias: string): Observable<IResource> {
        return Hal._storage.aliasData$(alias);
    }

    static clear() {
        Hal._storage.clear();
    }
}
