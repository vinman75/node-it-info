
/**
 * Calculates the relative path prefix (e.g., '', '../', '../../') needed
 * to navigate from the current page back to the documentation root directory.
 * Assumes the script is running in a browser context with window.location.
 * @returns {string} The relative path prefix.
 */
function getRelativePathPrefix() {
    const path = window.location.pathname;
    // console.log("Current Pathname:", path);

    // Try to find '/docs/' to reliably determine depth relative to the docs root
    const docsSegment = '/docs/';
    const docsIndex = path.indexOf(docsSegment);
    let depth = 0;

    if (docsIndex !== -1) {
        // Path relative to the *end* of '/docs/'
        const pathAfterDocs = path.substring(docsIndex + docsSegment.length);
        // Count non-empty segments (directories) *before* any potential filename
        const segments = pathAfterDocs.split('/').filter(Boolean);
        // If the last segment contains '.', assume it's a file, otherwise it's a directory index
        depth = segments.length - (segments.length > 0 && segments[segments.length - 1].includes('.') ? 1 : 0);
         // console.log(`Path relative to /docs/: '${pathAfterDocs}', Segments: ${segments}, Depth: ${depth}`);
    } else {
        // Fallback for local file:/// or server root deployments
        // Count directory separators in the path after the domain/root
        const pathSegments = path.split('/').filter(Boolean);
         // If the last segment looks like a file, don't count it as depth level
        depth = pathSegments.length - (pathSegments.length > 0 && pathSegments[pathSegments.length - 1].includes('.') ? 1 : 0);
         // Handle file:/// paths where the first segment might be the drive letter
         if (window.location.protocol === 'file:' && pathSegments.length > 0 && /^[a-zA-Z]:$/.test(pathSegments[0])) {
             depth = Math.max(0, depth -1); // Adjust if drive letter was counted
         }
        // console.log(`Fallback path segments: ${pathSegments}, Calculated Depth: ${depth}`);
    }

    // Ensure depth is not negative
    depth = Math.max(0, depth);

    const prefix = '../'.repeat(depth);
    // console.log("Calculated Relative Prefix:", prefix || "'' (root)");
    return prefix;
}


/**
 * Injects the navigation HTML (from nav_data.js) into the <nav> element,
 * adjusting paths using the calculated relative prefix.
 */
function injectNavigation() {
    const navElement = document.querySelector('nav');
    if (!navElement) {
        console.error('FATAL: Navigation element (<nav>) not found in the HTML!');
        return false; // Indicate failure
    }

    // Check if navigation data is available (loaded from nav_data.js)
    if (typeof navHTML === 'undefined') {
        console.error('FATAL: Global `navHTML` variable not found. Was nav_data.js loaded correctly and before script.js?');
        navElement.innerHTML = '<p class="loading-placeholder">Error: Navigation data failed to load.</p>';
        return false; // Indicate failure
    }

    const relativePrefix = getRelativePathPrefix();

    // Replace placeholders like {REL_PREFIX} in the navHTML string
    // Using a simple string replace. Ensure placeholder is unique.
    const correctlyPathedNavHTML = navHTML.replace(/\{REL_PREFIX\}/g, relativePrefix);

    // Inject the final HTML
    navElement.innerHTML = correctlyPathedNavHTML;
    console.log("Navigation HTML injected successfully.");
    return true; // Indicate success
}

/**
 * Attaches click event listeners to category headers for toggling visibility.
 * Should be called *after* injectNavigation.
 */
function setupNavEventListeners() {
    const navElement = document.querySelector('nav');
    if (!navElement) return; // Should not happen if injectNavigation succeeded

    const categoryHeaders = navElement.querySelectorAll('.category-header');
    console.log(`Found ${categoryHeaders.length} category headers to attach listeners.`);

    categoryHeaders.forEach(header => {
        // Check if listener already exists (simple flag) to avoid duplicates if script runs unexpectedly again
        if (header.dataset.listenerAttached === 'true') {
            return;
        }

        header.addEventListener('click', function() {
            const categoryDiv = this.closest('.category'); // Use closest for robustness
            if (!categoryDiv) return;

            // Find the direct child UL element
            const ul = categoryDiv.querySelector(':scope > ul');
            if (ul) {
                const isVisible = ul.style.display === 'block';
                ul.style.display = isVisible ? 'none' : 'block';
                // console.log(`Toggled category '${categoryDiv.querySelector('.category-title').textContent}' to ${isVisible ? 'collapsed' : 'expanded'}`);
            } else {
                 // console.warn("Could not find direct child UL for category header:", this);
            }
        });
        header.dataset.listenerAttached = 'true'; // Mark as attached
    });
    console.log("Category toggle listeners attached.");
}


/**
 * Expands the navigation category corresponding to the current page URL.
 * Should be called *after* injectNavigation.
 */
function expandCurrentCategory() {
    const navElement = document.querySelector('nav');
    if (!navElement) return;

    try {
        const currentPath = window.location.pathname;
        // console.log("Attempting to expand category for path:", currentPath);

        // Determine the path relative to the 'docs' directory for matching links
        let relevantPath = '';
        const docsPrefix = '/docs/';
        const docsIndex = currentPath.indexOf(docsPrefix);

        if (docsIndex !== -1) {
            relevantPath = currentPath.substring(docsIndex + docsPrefix.length);
        } else {
            // Fallback: Try to get the last part(s) of the path
            const segments = currentPath.split('/').filter(Boolean);
            relevantPath = segments.slice(-2).join('/'); // Try category/file.html
            if (segments.length === 1 || !relevantPath.includes('/')) { // Or just file.html
                 relevantPath = segments.slice(-1).join('/');
            }
             // If it's an empty string (root index) or just 'index.html', skip expansion
            if (relevantPath === '' || relevantPath === 'index.html') {
                 // console.log("Skipping category expansion for index page.");
                 return;
            }
        }

        // console.log("Normalized relevant path for link matching:", relevantPath);

        // Find the navigation link (<a> tag) inside the populated <nav> that matches this path
        let activeLink = null;
        // Query links inside the nav element to ensure they exist after injection
        const linksInNav = navElement.querySelectorAll('a');
         // console.log(`Searching for link with href='${relevantPath}' among ${linksInNav.length} links.`);

        linksInNav.forEach(link => {
            const hrefAttr = link.getAttribute('href');
            // Links generated by python use {REL_PREFIX}, JS replaces it.
            // The hrefAttr *should* now be relative from the current page.
            // We need to compare `relevantPath` (relative to docs root) with the link's effective path.
            // Simplest approach: The generated nav_data.js uses root-relative paths (after prefix replacement)
            // So, we compare `relevantPath` directly with `hrefAttr` (assuming prefix was handled)

            // Let's re-evaluate: The links in nav_data.js are like "{REL_PREFIX}nodes/MyNode.html".
            // After replacement, hrefAttr will be like "../nodes/MyNode.html" or "nodes/MyNode.html".
            // `relevantPath` is like "nodes/MyNode.html".
            // We need to match the *target* path, not the href value directly.
            // Let's construct the *expected* target path from the link's href relative to the docs root.

            // A potentially easier way: Compare the *filename* part? Less robust.
            // Let's stick to matching the `relevantPath`. We need the href attribute *after* prefix replacement.
            // The comparison needs hrefAttr (which now includes the prefix) to point to the same resource as relevantPath (which is relative to docs root).

            // Let's assume the comparison should be against the part *after* the prefix.
            const linkTarget = hrefAttr.substring(getRelativePathPrefix().length); // Get path relative to docs root from the link

            if (hrefAttr && linkTarget === relevantPath) {
                activeLink = link;
                // console.log(`Found active link:`, activeLink, `(href='${hrefAttr}', target='${linkTarget}')`);
            }
        });


        if (activeLink) {
            // Find the closest parent 'ul' for this link
            const parentUl = activeLink.closest('ul');
            if (parentUl && parentUl.closest('.category')) { // Ensure it's a category UL
                // console.log("Found parent UL:", parentUl);
                parentUl.style.display = 'block';
                // console.log("Set parent UL display to 'block'");

                // Optional: Walk up and expand parent categories if nested (not currently supported by HTML structure)
            } else {
                // console.warn("Found active link but couldn't find parent UL within a .category element:", activeLink);
            }
        } else {
            // console.log(`No active link found matching relevant path '${relevantPath}'.`);
        }
    } catch (e) {
        console.error("Error during category expansion:", e);
    }
}

let processedSearchableData = []; // To store data with path-adjusted URLs

/**
 * Processes the raw searchableData to make URLs relative to the current page.
 * Needs to be called after getRelativePathPrefix is available and searchableData is loaded.
 */
function initializeSearchData() {
    if (typeof searchableData === 'undefined' || !Array.isArray(searchableData)) {
        console.error('Search Data: `searchableData` is not available or not an array.');
        return;
    }
    const relativePrefix = getRelativePathPrefix();
    processedSearchableData = searchableData.map(item => ({
        ...item,
        // Prepend the relative prefix to the stored URL (which is root-relative)
        url: relativePrefix + item.url 
    }));
    // console.log('Processed Searchable Data:', processedSearchableData);
}

/**
 * Filters and displays search results.
 * @param {string} query The search query.
 */
function handleSearchInput(query) {
    const resultsContainer = document.getElementById('searchResultsContainer');
    const searchInput = document.getElementById('searchInput'); // For positioning
    if (!resultsContainer || !searchInput) return;

    query = query.toLowerCase().trim();
    resultsContainer.innerHTML = ''; // Clear previous results

    if (!query) {
        resultsContainer.style.display = 'none';
        return;
    }

    const filteredResults = processedSearchableData.filter(item => 
        item.title.toLowerCase().includes(query)
    );

    if (filteredResults.length > 0) {
        filteredResults.forEach(item => {
            const link = document.createElement('a');
            link.href = item.url; // URL is already processed to be page-relative
            link.textContent = item.title;
            // Close results when a link is clicked
            link.addEventListener('click', () => {
                resultsContainer.style.display = 'none';
                document.getElementById('searchInput').value = ''; // Clear search input
            });
            resultsContainer.appendChild(link);
        });
    } else {
        const noResultsMessage = document.createElement('div');
        noResultsMessage.className = 'no-results';
        noResultsMessage.textContent = 'No results found.';
        resultsContainer.appendChild(noResultsMessage);
    }
    resultsContainer.style.display = 'block';
}

/**
 * Sets up event listeners for the search functionality.
 */
function setupSearchEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('searchResultsContainer');
    if (!searchInput || !resultsContainer) {
        console.error('Search: Input field or results container not found.');
        return;
    }
    searchInput.addEventListener('input', function(event) {
        handleSearchInput(event.target.value);
    });
    searchInput.addEventListener('focus', function() {
        // Show results if there's text, or potentially recent searches (not implemented)
        if (this.value.trim()) {
            handleSearchInput(this.value);
        }
    });
    // Hide results when clicking outside
    document.addEventListener('click', function(event) {
        if (!searchInput.contains(event.target) && !resultsContainer.contains(event.target)) {
            resultsContainer.style.display = 'none';
        }
    });
    // Prevent hiding when clicking inside results container (already handled by link click)
    // resultsContainer.addEventListener('click', function(event) {
    //     event.stopPropagation(); // Stop click from bubbling to document listener
    // });
    
    console.log("Search event listeners attached.");
}

// --- Main Execution ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded. Initializing help page script...");

    // 1. Inject the navigation HTML
    const navInjected = injectNavigation();

    // 2. Only proceed if navigation was successfully injected
    if (navInjected) {
        // 3. Attach event listeners to the newly added navigation elements
        setupNavEventListeners();

        // 4. Expand the current category based on the URL
        expandCurrentCategory();

        // --- START OF ADDED SEARCH INITIALIZATION ---
        // 5. Initialize search data (process URLs)
        initializeSearchData(); 

        // 6. Attach event listeners for search input
        setupSearchEventListeners();
        // --- END OF ADDED SEARCH INITIALIZATION ---

    } else {
        console.error("Help page script initialization failed due to navigation injection error.")
    }

    console.log("Help page script initialization complete.");
});
