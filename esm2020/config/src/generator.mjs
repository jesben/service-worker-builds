/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { parseDurationToMs } from './duration';
import { globToRegex } from './glob';
const DEFAULT_NAVIGATION_URLS = [
    '/**',
    '!/**/*.*',
    '!/**/*__*',
    '!/**/*__*/**', // Exclude URLs containing `__` in any other segment.
];
/**
 * Consumes service worker configuration files and processes them into control files.
 *
 * @publicApi
 */
export class Generator {
    constructor(fs, baseHref) {
        this.fs = fs;
        this.baseHref = baseHref;
    }
    async process(config) {
        const unorderedHashTable = {};
        const assetGroups = await this.processAssetGroups(config, unorderedHashTable);
        return {
            configVersion: 1,
            timestamp: Date.now(),
            appData: config.appData,
            index: joinUrls(this.baseHref, config.index),
            assetGroups,
            dataGroups: this.processDataGroups(config),
            hashTable: withOrderedKeys(unorderedHashTable),
            navigationUrls: processNavigationUrls(this.baseHref, config.navigationUrls),
            navigationRequestStrategy: config.navigationRequestStrategy ?? 'performance',
        };
    }
    async processAssetGroups(config, hashTable) {
        // Retrieve all files of the build.
        const allFiles = await this.fs.list('/');
        const seenMap = new Set();
        const filesPerGroup = new Map();
        // Computed which files belong to each asset-group.
        for (const group of (config.assetGroups || [])) {
            if (group.resources.versionedFiles) {
                throw new Error(`Asset-group '${group.name}' in 'ngsw-config.json' uses the 'versionedFiles' option, ` +
                    'which is no longer supported. Use \'files\' instead.');
            }
            const fileMatcher = globListToMatcher(group.resources.files || []);
            const matchedFiles = allFiles.filter(fileMatcher).filter(file => !seenMap.has(file)).sort();
            matchedFiles.forEach(file => seenMap.add(file));
            filesPerGroup.set(group, matchedFiles);
        }
        // Compute hashes for all matched files and add them to the hash-table.
        const allMatchedFiles = [].concat(...Array.from(filesPerGroup.values())).sort();
        const allMatchedHashes = await Promise.all(allMatchedFiles.map(file => this.fs.hash(file)));
        allMatchedFiles.forEach((file, idx) => {
            hashTable[joinUrls(this.baseHref, file)] = allMatchedHashes[idx];
        });
        // Generate and return the processed asset-groups.
        return Array.from(filesPerGroup.entries())
            .map(([group, matchedFiles]) => ({
            name: group.name,
            installMode: group.installMode || 'prefetch',
            updateMode: group.updateMode || group.installMode || 'prefetch',
            cacheQueryOptions: buildCacheQueryOptions(group.cacheQueryOptions),
            urls: matchedFiles.map(url => joinUrls(this.baseHref, url)),
            patterns: (group.resources.urls || []).map(url => urlToRegex(url, this.baseHref, true)),
        }));
    }
    processDataGroups(config) {
        return (config.dataGroups || []).map(group => {
            return {
                name: group.name,
                patterns: group.urls.map(url => urlToRegex(url, this.baseHref, true)),
                strategy: group.cacheConfig.strategy || 'performance',
                maxSize: group.cacheConfig.maxSize,
                maxAge: parseDurationToMs(group.cacheConfig.maxAge),
                timeoutMs: group.cacheConfig.timeout && parseDurationToMs(group.cacheConfig.timeout),
                cacheQueryOptions: buildCacheQueryOptions(group.cacheQueryOptions),
                version: group.version !== undefined ? group.version : 1,
            };
        });
    }
}
export function processNavigationUrls(baseHref, urls = DEFAULT_NAVIGATION_URLS) {
    return urls.map(url => {
        const positive = !url.startsWith('!');
        url = positive ? url : url.substr(1);
        return { positive, regex: `^${urlToRegex(url, baseHref)}$` };
    });
}
function globListToMatcher(globs) {
    const patterns = globs.map(pattern => {
        if (pattern.startsWith('!')) {
            return {
                positive: false,
                regex: new RegExp('^' + globToRegex(pattern.substr(1)) + '$'),
            };
        }
        else {
            return {
                positive: true,
                regex: new RegExp('^' + globToRegex(pattern) + '$'),
            };
        }
    });
    return (file) => matches(file, patterns);
}
function matches(file, patterns) {
    const res = patterns.reduce((isMatch, pattern) => {
        if (pattern.positive) {
            return isMatch || pattern.regex.test(file);
        }
        else {
            return isMatch && !pattern.regex.test(file);
        }
    }, false);
    return res;
}
function urlToRegex(url, baseHref, literalQuestionMark) {
    if (!url.startsWith('/') && url.indexOf('://') === -1) {
        // Prefix relative URLs with `baseHref`.
        // Strip a leading `.` from a relative `baseHref` (e.g. `./foo/`), since it would result in an
        // incorrect regex (matching a literal `.`).
        url = joinUrls(baseHref.replace(/^\.(?=\/)/, ''), url);
    }
    return globToRegex(url, literalQuestionMark);
}
function joinUrls(a, b) {
    if (a.endsWith('/') && b.startsWith('/')) {
        return a + b.substr(1);
    }
    else if (!a.endsWith('/') && !b.startsWith('/')) {
        return a + '/' + b;
    }
    return a + b;
}
function withOrderedKeys(unorderedObj) {
    const orderedObj = {};
    Object.keys(unorderedObj).sort().forEach(key => orderedObj[key] = unorderedObj[key]);
    return orderedObj;
}
function buildCacheQueryOptions(inOptions) {
    return {
        ignoreVary: true,
        ...inOptions,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvc2VydmljZS13b3JrZXIvY29uZmlnL3NyYy9nZW5lcmF0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sWUFBWSxDQUFDO0FBRTdDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFHbkMsTUFBTSx1QkFBdUIsR0FBRztJQUM5QixLQUFLO0lBQ0wsVUFBVTtJQUNWLFdBQVc7SUFDWCxjQUFjLEVBQUcscURBQXFEO0NBQ3ZFLENBQUM7QUFFRjs7OztHQUlHO0FBQ0gsTUFBTSxPQUFPLFNBQVM7SUFDcEIsWUFBcUIsRUFBYyxFQUFVLFFBQWdCO1FBQXhDLE9BQUUsR0FBRixFQUFFLENBQVk7UUFBVSxhQUFRLEdBQVIsUUFBUSxDQUFRO0lBQUcsQ0FBQztJQUVqRSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQWM7UUFDMUIsTUFBTSxrQkFBa0IsR0FBRyxFQUFFLENBQUM7UUFDOUIsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFFOUUsT0FBTztZQUNMLGFBQWEsRUFBRSxDQUFDO1lBQ2hCLFNBQVMsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1lBQ3JCLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTztZQUN2QixLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQztZQUM1QyxXQUFXO1lBQ1gsVUFBVSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUM7WUFDMUMsU0FBUyxFQUFFLGVBQWUsQ0FBQyxrQkFBa0IsQ0FBQztZQUM5QyxjQUFjLEVBQUUscUJBQXFCLENBQUMsSUFBSSxDQUFD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SUFDRCxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDZixDQUFDO0FBRUQsU0FBUyxlQUFlLENBQWlDLFlBQWU7SUFDdEUsTUFBTSxVQUFVLEdBQUcsRUFBMEIsQ0FBQztJQUM5QyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNyRixPQUFPLFVBQWUsQ0FBQztBQUN6QixDQUFDO0FBRUQsU0FBUyxzQkFBc0IsQ0FBQyxTQUFtRDtJQUVqRixPQUFPO1FBQ0wsVUFBVSxFQUFFLElBQUk7UUFDaEIsR0FBRyxTQUFTO0tBQ2IsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtwYXJzZUR1cmF0aW9uVG9Nc30gZnJvbSAnLi9kdXJhdGlvbic7XG5pbXBvcnQge0ZpbGVzeXN0ZW19IGZyb20gJy4vZmlsZXN5c3RlbSc7XG5pbXBvcnQge2dsb2JUb1JlZ2V4fSBmcm9tICcuL2dsb2InO1xuaW1wb3J0IHtBc3NldEdyb3VwLCBDb25maWd9IGZyb20gJy4vaW4nO1xuXG5jb25zdCBERUZBVUxUX05BVklHQVRJT05fVVJMUyA9IFtcbiAgJy8qKicsICAgICAgICAgICAvLyBJbmNsdWRlIGFsbCBVUkxzLlxuICAnIS8qKi8qLionLCAgICAgIC8vIEV4Y2x1ZGUgVVJMcyB0byBmaWxlcyAoY29udGFpbmluZyBhIGZpbGUgZXh0ZW5zaW9uIGluIHRoZSBsYXN0IHNlZ21lbnQpLlxuICAnIS8qKi8qX18qJywgICAgIC8vIEV4Y2x1ZGUgVVJMcyBjb250YWluaW5nIGBfX2AgaW4gdGhlIGxhc3Qgc2VnbWVudC5cbiAgJyEvKiovKl9fKi8qKicsICAvLyBFeGNsdWRlIFVSTHMgY29udGFpbmluZyBgX19gIGluIGFueSBvdGhlciBzZWdtZW50LlxuXTtcblxuLyoqXG4gKiBDb25zdW1lcyBzZXJ2aWNlIHdvcmtlciBjb25maWd1cmF0aW9uIGZpbGVzIGFuZCBwcm9jZXNzZXMgdGhlbSBpbnRvIGNvbnRyb2wgZmlsZXMuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY2xhc3MgR2VuZXJhdG9yIHtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgZnM6IEZpbGVzeXN0ZW0sIHByaXZhdGUgYmFzZUhyZWY6IHN0cmluZykge31cblxuICBhc3luYyBwcm9jZXNzKGNvbmZpZzogQ29uZmlnKTogUHJvbWlzZTxPYmplY3Q+IHtcbiAgICBjb25zdCB1bm9yZGVyZWRIYXNoVGFibGUgPSB7fTtcbiAgICBjb25zdCBhc3NldEdyb3VwcyA9IGF3YWl0IHRoaXMucHJvY2Vzc0Fzc2V0R3JvdXBzKGNvbmZpZywgdW5vcmRlcmVkSGFzaFRhYmxlKTtcblxuICAgIHJldHVybiB7XG4gICAgICBjb25maWdWZXJzaW9uOiAxLFxuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgYXBwRGF0YTogY29uZmlnLmFwcERhdGEsXG4gICAgICBpbmRleDogam9pblVybHModGhpcy5iYXNlSHJlZiwgY29uZmlnLmluZGV4KSxcbiAgICAgIGFzc2V0R3JvdXBzLFxuICAgICAgZGF0YUdyb3VwczogdGhpcy5wcm9jZXNzRGF0YUdyb3Vwcyhjb25maWcpLFxuICAgICAgaGFzaFRhYmxlOiB3aXRoT3JkZXJlZEtleXModW5vcmRlcmVkSGFzaFRhYmxlKSxcbiAgICAgIG5hdmlnYXRpb25VcmxzOiBwcm9jZXNzTmF2aWdhdGlvblVybHModGhpcy5iYXNlSHJlZiwgY29uZmlnLm5hdmlnYXRpb25VcmxzKSxcbiAgICAgIG5hdmlnYXRpb25SZXF1ZXN0U3RyYXRlZ3k6IGNvbmZpZy5uYXZpZ2F0aW9uUmVxdWVzdFN0cmF0ZWd5ID8/ICdwZXJmb3JtYW5jZScsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcHJvY2Vzc0Fzc2V0R3JvdXBzKGNvbmZpZzogQ29uZmlnLCBoYXNoVGFibGU6IHtbZmlsZTogc3RyaW5nXTogc3RyaW5nfHVuZGVmaW5lZH0pOlxuICAgICAgUHJvbWlzZTxPYmplY3RbXT4ge1xuICAgIC8vIFJldHJpZXZlIGFsbCBmaWxlcyBvZiB0aGUgYnVpbGQuXG4gICAgY29uc3QgYWxsRmlsZXMgPSBhd2FpdCB0aGlzLmZzLmxpc3QoJy8nKTtcbiAgICBjb25zdCBzZWVuTWFwID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgZmlsZXNQZXJHcm91cCA9IG5ldyBNYXA8QXNzZXRHcm91cCwgc3RyaW5nW10+KCk7XG5cbiAgICAvLyBDb21wdXRlZCB3aGljaCBmaWxlcyBiZWxvbmcgdG8gZWFjaCBhc3NldC1ncm91cC5cbiAgICBmb3IgKGNvbnN0IGdyb3VwIG9mIChjb25maWcuYXNzZXRHcm91cHMgfHwgW10pKSB7XG4gICAgICBpZiAoKGdyb3VwLnJlc291cmNlcyBhcyBhbnkpLnZlcnNpb25lZEZpbGVzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBBc3NldC1ncm91cCAnJHtncm91cC5uYW1lfScgaW4gJ25nc3ctY29uZmlnLmpzb24nIHVzZXMgdGhlICd2ZXJzaW9uZWRGaWxlcycgb3B0aW9uLCBgICtcbiAgICAgICAgICAgICd3aGljaCBpcyBubyBsb25nZXIgc3VwcG9ydGVkLiBVc2UgXFwnZmlsZXNcXCcgaW5zdGVhZC4nKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZmlsZU1hdGNoZXIgPSBnbG9iTGlzdFRvTWF0Y2hlcihncm91cC5yZXNvdXJjZXMuZmlsZXMgfHwgW10pO1xuICAgICAgY29uc3QgbWF0Y2hlZEZpbGVzID0gYWxsRmlsZXMuZmlsdGVyKGZpbGVNYXRjaGVyKS5maWx0ZXIoZmlsZSA9PiAhc2Vlbk1hcC5oYXMoZmlsZSkpLnNvcnQoKTtcblxuICAgICAgbWF0Y2hlZEZpbGVzLmZvckVhY2goZmlsZSA9PiBzZWVuTWFwLmFkZChmaWxlKSk7XG4gICAgICBmaWxlc1Blckdyb3VwLnNldChncm91cCwgbWF0Y2hlZEZpbGVzKTtcbiAgICB9XG5cbiAgICAvLyBDb21wdXRlIGhhc2hlcyBmb3IgYWxsIG1hdGNoZWQgZmlsZXMgYW5kIGFkZCB0aGVtIHRvIHRoZSBoYXNoLXRhYmxlLlxuICAgIGNvbnN0IGFsbE1hdGNoZWRGaWxlcyA9IChbXSBhcyBzdHJpbmdbXSkuY29uY2F0KC4uLkFycmF5LmZyb20oZmlsZXNQZXJHcm91cC52YWx1ZXMoKSkpLnNvcnQoKTtcbiAgICBjb25zdCBhbGxNYXRjaGVkSGFzaGVzID0gYXdhaXQgUHJvbWlzZS5hbGwoYWxsTWF0Y2hlZEZpbGVzLm1hcChmaWxlID0+IHRoaXMuZnMuaGFzaChmaWxlKSkpO1xuICAgIGFsbE1hdGNoZWRGaWxlcy5mb3JFYWNoKChmaWxlLCBpZHgpID0+IHtcbiAgICAgIGhhc2hUYWJsZVtqb2luVXJscyh0aGlzLmJhc2VIcmVmLCBmaWxlKV0gPSBhbGxNYXRjaGVkSGFzaGVzW2lkeF07XG4gICAgfSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBhbmQgcmV0dXJuIHRoZSBwcm9jZXNzZWQgYXNzZXQtZ3JvdXBzLlxuICAgIHJldHVybiBBcnJheS5mcm9tKGZpbGVzUGVyR3JvdXAuZW50cmllcygpKVxuICAgICAgICAubWFwKChbZ3JvdXAsIG1hdGNoZWRGaWxlc10pID0+ICh7XG4gICAgICAgICAgICAgICBuYW1lOiBncm91cC5uYW1lLFxuICAgICAgICAgICAgICAgaW5zdGFsbE1vZGU6IGdyb3VwLmluc3RhbGxNb2RlIHx8ICdwcmVmZXRjaCcsXG4gICAgICAgICAgICAgICB1cGRhdGVNb2RlOiBncm91cC51cGRhdGVNb2RlIHx8IGdyb3VwLmluc3RhbGxNb2RlIHx8ICdwcmVmZXRjaCcsXG4gICAgICAgICAgICAgICBjYWNoZVF1ZXJ5T3B0aW9uczogYnVpbGRDYWNoZVF1ZXJ5T3B0aW9ucyhncm91cC5jYWNoZVF1ZXJ5T3B0aW9ucyksXG4gICAgICAgICAgICAgICB1cmxzOiBtYXRjaGVkRmlsZXMubWFwKHVybCA9PiBqb2luVXJscyh0aGlzLmJhc2VIcmVmLCB1cmwpKSxcbiAgICAgICAgICAgICAgIHBhdHRlcm5zOlxuICAgICAgICAgICAgICAgICAgIChncm91cC5yZXNvdXJjZXMudXJscyB8fCBbXSkubWFwKHVybCA9PiB1cmxUb1JlZ2V4KHVybCwgdGhpcy5iYXNlSHJlZiwgdHJ1ZSkpLFxuICAgICAgICAgICAgIH0pKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJvY2Vzc0RhdGFHcm91cHMoY29uZmlnOiBDb25maWcpOiBPYmplY3RbXSB7XG4gICAgcmV0dXJuIChjb25maWcuZGF0YUdyb3VwcyB8fCBbXSkubWFwKGdyb3VwID0+IHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IGdyb3VwLm5hbWUsXG4gICAgICAgIHBhdHRlcm5zOiBncm91cC51cmxzLm1hcCh1cmwgPT4gdXJsVG9SZWdleCh1cmwsIHRoaXMuYmFzZUhyZWYsIHRydWUpKSxcbiAgICAgICAgc3RyYXRlZ3k6IGdyb3VwLmNhY2hlQ29uZmlnLnN0cmF0ZWd5IHx8ICdwZXJmb3JtYW5jZScsXG4gICAgICAgIG1heFNpemU6IGdyb3VwLmNhY2hlQ29uZmlnLm1heFNpemUsXG4gICAgICAgIG1heEFnZTogcGFyc2VEdXJhdGlvblRvTXMoZ3JvdXAuY2FjaGVDb25maWcubWF4QWdlKSxcbiAgICAgICAgdGltZW91dE1zOiBncm91cC5jYWNoZUNvbmZpZy50aW1lb3V0ICYmIHBhcnNlRHVyYXRpb25Ub01zKGdyb3VwLmNhY2hlQ29uZmlnLnRpbWVvdXQpLFxuICAgICAgICBjYWNoZVF1ZXJ5T3B0aW9uczogYnVpbGRDYWNoZVF1ZXJ5T3B0aW9ucyhncm91cC5jYWNoZVF1ZXJ5T3B0aW9ucyksXG4gICAgICAgIHZlcnNpb246IGdyb3VwLnZlcnNpb24gIT09IHVuZGVmaW5lZCA/IGdyb3VwLnZlcnNpb24gOiAxLFxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvY2Vzc05hdmlnYXRpb25VcmxzKFxuICAgIGJhc2VIcmVmOiBzdHJpbmcsIHVybHMgPSBERUZBVUxUX05BVklHQVRJT05fVVJMUyk6IHtwb3NpdGl2ZTogYm9vbGVhbiwgcmVnZXg6IHN0cmluZ31bXSB7XG4gIHJldHVybiB1cmxzLm1hcCh1cmwgPT4ge1xuICAgIGNvbnN0IHBvc2l0aXZlID0gIXVybC5zdGFydHNXaXRoKCchJyk7XG4gICAgdXJsID0gcG9zaXRpdmUgPyB1cmwgOiB1cmwuc3Vic3RyKDEpO1xuICAgIHJldHVybiB7cG9zaXRpdmUsIHJlZ2V4OiBgXiR7dXJsVG9SZWdleCh1cmwsIGJhc2VIcmVmKX0kYH07XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBnbG9iTGlzdFRvTWF0Y2hlcihnbG9iczogc3RyaW5nW10pOiAoZmlsZTogc3RyaW5nKSA9PiBib29sZWFuIHtcbiAgY29uc3QgcGF0dGVybnMgPSBnbG9icy5tYXAocGF0dGVybiA9PiB7XG4gICAgaWYgKHBhdHRlcm4uc3RhcnRzV2l0aCgnIScpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBwb3NpdGl2ZTogZmFsc2UsXG4gICAgICAgIHJlZ2V4OiBuZXcgUmVnRXhwKCdeJyArIGdsb2JUb1JlZ2V4KHBhdHRlcm4uc3Vic3RyKDEpKSArICckJyksXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBwb3NpdGl2ZTogdHJ1ZSxcbiAgICAgICAgcmVnZXg6IG5ldyBSZWdFeHAoJ14nICsgZ2xvYlRvUmVnZXgocGF0dGVybikgKyAnJCcpLFxuICAgICAgfTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gKGZpbGU6IHN0cmluZykgPT4gbWF0Y2hlcyhmaWxlLCBwYXR0ZXJucyk7XG59XG5cbmZ1bmN0aW9uIG1hdGNoZXMoZmlsZTogc3RyaW5nLCBwYXR0ZXJuczoge3Bvc2l0aXZlOiBib29sZWFuLCByZWdleDogUmVnRXhwfVtdKTogYm9vbGVhbiB7XG4gIGNvbnN0IHJlcyA9IHBhdHRlcm5zLnJlZHVjZSgoaXNNYXRjaCwgcGF0dGVybikgPT4ge1xuICAgIGlmIChwYXR0ZXJuLnBvc2l0aXZlKSB7XG4gICAgICByZXR1cm4gaXNNYXRjaCB8fCBwYXR0ZXJuLnJlZ2V4LnRlc3QoZmlsZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBpc01hdGNoICYmICFwYXR0ZXJuLnJlZ2V4LnRlc3QoZmlsZSk7XG4gICAgfVxuICB9LCBmYWxzZSk7XG4gIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIHVybFRvUmVnZXgodXJsOiBzdHJpbmcsIGJhc2VIcmVmOiBzdHJpbmcsIGxpdGVyYWxRdWVzdGlvbk1hcms/OiBib29sZWFuKTogc3RyaW5nIHtcbiAgaWYgKCF1cmwuc3RhcnRzV2l0aCgnLycpICYmIHVybC5pbmRleE9mKCc6Ly8nKSA9PT0gLTEpIHtcbiAgICAvLyBQcmVmaXggcmVsYXRpdmUgVVJMcyB3aXRoIGBiYXNlSHJlZmAuXG4gICAgLy8gU3RyaXAgYSBsZWFkaW5nIGAuYCBmcm9tIGEgcmVsYXRpdmUgYGJhc2VIcmVmYCAoZS5nLiBgLi9mb28vYCksIHNpbmNlIGl0IHdvdWxkIHJlc3VsdCBpbiBhblxuICAgIC8vIGluY29ycmVjdCByZWdleCAobWF0Y2hpbmcgYSBsaXRlcmFsIGAuYCkuXG4gICAgdXJsID0gam9pblVybHMoYmFzZUhyZWYucmVwbGFjZSgvXlxcLig/PVxcLykvLCAnJyksIHVybCk7XG4gIH1cblxuICByZXR1cm4gZ2xvYlRvUmVnZXgodXJsLCBsaXRlcmFsUXVlc3Rpb25NYXJrKTtcbn1cblxuZnVuY3Rpb24gam9pblVybHMoYTogc3RyaW5nLCBiOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoYS5lbmRzV2l0aCgnLycpICYmIGIuc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgcmV0dXJuIGEgKyBiLnN1YnN0cigxKTtcbiAgfSBlbHNlIGlmICghYS5lbmRzV2l0aCgnLycpICYmICFiLnN0YXJ0c1dpdGgoJy8nKSkge1xuICAgIHJldHVybiBhICsgJy8nICsgYjtcbiAgfVxuICByZXR1cm4gYSArIGI7XG59XG5cbmZ1bmN0aW9uIHdpdGhPcmRlcmVkS2V5czxUIGV4dGVuZHMge1trZXk6IHN0cmluZ106IGFueX0+KHVub3JkZXJlZE9iajogVCk6IFQge1xuICBjb25zdCBvcmRlcmVkT2JqID0ge30gYXMge1trZXk6IHN0cmluZ106IGFueX07XG4gIE9iamVjdC5rZXlzKHVub3JkZXJlZE9iaikuc29ydCgpLmZvckVhY2goa2V5ID0+IG9yZGVyZWRPYmpba2V5XSA9IHVub3JkZXJlZE9ialtrZXldKTtcbiAgcmV0dXJuIG9yZGVyZWRPYmogYXMgVDtcbn1cblxuZnVuY3Rpb24gYnVpbGRDYWNoZVF1ZXJ5T3B0aW9ucyhpbk9wdGlvbnM/OiBQaWNrPENhY2hlUXVlcnlPcHRpb25zLCAnaWdub3JlU2VhcmNoJz4pOlxuICAgIENhY2hlUXVlcnlPcHRpb25zIHtcbiAgcmV0dXJuIHtcbiAgICBpZ25vcmVWYXJ5OiB0cnVlLFxuICAgIC4uLmluT3B0aW9ucyxcbiAgfTtcbn1cbiJdfQ==