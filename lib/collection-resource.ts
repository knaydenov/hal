import { IResource, Resource } from "./resource";

export interface ICollectionResource extends IResource {
    _links: {
        self: {
            href: string
        };
    };
    _embedded: {
        items: any[]
    };
}

export class CollectionResource<T> extends Resource<ICollectionResource> {
    get items(): T[] {
        return this.getEmbedded('items', []);
    }
}
