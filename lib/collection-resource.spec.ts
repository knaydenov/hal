
import {first} from 'rxjs/operators';
import { expect } from 'chai';
import * as sinon from 'ts-sinon';
// import {  } from 'chai-as-promised';

import { CollectionResource } from './collection-resource';
import { Hal } from './hal';
import { FakeHttp } from './test/fake-http';
import { FakeStorage } from './test/fake-storage';



describe('CollectionResource', () => {
    describe('#get items', () => {
        it('should return valid items', async () => {
            Hal.init(
                {
                    http: new FakeHttp,
                    storage: new FakeStorage
                }
            );

            let species: CollectionResource<string> = CollectionResource.fromUrl<CollectionResource<string>>('/species');
            await species.data$.pipe(first()).toPromise();
            expect(species.items).is.eqls(['cat', 'dog', 'bird']);

            Hal.clear();
        });

        it('should return empty array by default', async () => {
            Hal.init(
                {
                    http: new FakeHttp,
                    storage: new FakeStorage
                }
            );
            
            let species: CollectionResource<string> = CollectionResource.fromUrl<CollectionResource<string>>('/me');
            await species.data$.pipe(first()).toPromise();
            expect(species.items).is.eqls([]);
            Hal.clear();
        });
    });
});

