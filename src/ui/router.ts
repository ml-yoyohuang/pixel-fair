export const eventPath = '/event/twilight-only';
export class UIRouter {
    private last = '';
    private listener = () => {
        const path = this.path();
        if (this.last !== path) {
            this.last = path;
            this.onChange(path);
        }
    };
    constructor(public onChange: (path: string) => void) {
        window.addEventListener('hashchange', this.listener);
        window.addEventListener('popstate', this.listener);
        const initial = this.path();
        history.replaceState({ street: true, parent: null }, '', `#${eventPath}`);
        if (initial !== eventPath) {
            const ancestors = [eventPath];
            if (initial.includes('/booth/')) {
                const parts = initial.split('/');
                if (parts.length >= 5)
                    ancestors.push(parts.slice(0, 5).join('/'));
                if (parts.length >= 7)
                    ancestors.push(parts.slice(0, 7).join('/'));
                if (parts.length >= 8)
                    ancestors.push(parts.slice(0, 8).join('/'));
            }
            for (const path of [...new Set([...ancestors, initial])].slice(1)) {
                history.pushState({ street: true, parent: this.path() }, '', `#${path}`);
            }
        }
        this.last = this.path();
    }
    path() {
        try {
            return decodeURI(location.hash.slice(1)) || eventPath;
        }
        catch {
            return '/invalid';
        }
    }
    go(path: string, replace = false) {
        const parent = this.path();
        if (replace)
            history.replaceState({ ...history.state, street: true }, '', `#${path}`);
        else if (path !== parent)
            history.pushState({ street: true, parent }, '', `#${path}`);
        this.last = path;
        this.onChange(path);
    }
    close() {
        const path = this.path();
        let parent = eventPath;
        if (path.includes('/preview/image/'))
            parent = path.split('/image/')[0];
        else if (path.endsWith('/preview'))
            parent = path.slice(0, -8);
        else if (path.includes('/work/'))
            parent = path.split('/work/')[0];
        if (history.state?.street && history.state.parent === parent)
            history.back();
        else
            this.go(parent, true);
    }
    destroy() { window.removeEventListener('hashchange', this.listener); window.removeEventListener('popstate', this.listener); }
}
