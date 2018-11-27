export class FakeStorage implements Storage {
    private _data: {[key: string]: any} = {};

    get length(): number {
        return Object.keys(this._data).length;
    }
    clear(): void {
        this._data = {};
    }

    getItem(key: string): string | null {
        return this._data[key] ? this._data[key] : null;
    }

    key(index: number): string | null {
        const key = Object.keys(this._data)[index];
        return key !== undefined ? key : null;
    }

    removeItem(key: string): void {
        if (this._data[key]) {
            delete this._data[key];
        }
    }

    setItem(key: string, value: string): void {
        this._data[key] = value;
    }
}