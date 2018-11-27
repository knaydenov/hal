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

export class CollectionResource<T> extends Resource<any> {
    get items(): T[] {
        return <T[]>this.getEmbedded<T[]>('items', []);
    }
}
