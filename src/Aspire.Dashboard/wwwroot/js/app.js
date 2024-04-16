
// To avoid Flash of Unstyled Content, the body is hidden by default with
// the before-upgrade CSS class. Here we'll find the first web component
// and wait for it to be upgraded. When it is, we'll remove that class
// from the body.
const firstUndefinedElement = document.body.querySelector(":not(:defined)");

if (firstUndefinedElement) {
    customElements.whenDefined(firstUndefinedElement.localName).then(() => {
        document.body.classList.remove("before-upgrade");
    });
} else {
    // In the event this code doesn't run until after they've all been upgraded
    document.body.classList.remove("before-upgrade");
}

// Register a global click event listener to handle copy button clicks.
// Required because an "onclick" attribute is denied by CSP.
document.addEventListener("click", function (e) {
    if (e.target.type === "button" && e.target.getAttribute("data-copybutton")) {
        buttonCopyTextToClipboard(e.target);
        e.stopPropagation();
    }
});

let isScrolledToContent = false;
let lastScrollHeight = null;

window.getIsScrolledToContent = function () {
    return isScrolledToContent;
}

window.setIsScrolledToContent = function (value) {
    if (isScrolledToContent != value) {
        isScrolledToContent = value;
    }
}

window.resetContinuousScrollPosition = function () {
    // Reset to scrolling to the end of the content after switching.
    setIsScrolledToContent(false);
}

window.initializeContinuousScroll = function () {
    // Reset to scrolling to the end of the content when initializing.
    // This needs to be called because the value is remembered across Aspire pages because the browser isn't reloading.
    resetContinuousScrollPosition();

    const container = document.querySelector('.continuous-scroll-overflow');
    if (container == null) {
        return;
    }

    // The scroll event is used to detect when the user scrolls to view content.
    container.addEventListener('scroll', () => {
        var v = !isScrolledToBottom(container);
        setIsScrolledToContent(v);
   }, { passive: true });

    // The ResizeObserver reports changes in the grid size.
    // This ensures that the logs are scrolled to the bottom when there are new logs
    // unless the user has scrolled to view content.
    const observer = new ResizeObserver(function () {
        lastScrollHeight = container.scrollHeight;
        if (!getIsScrolledToContent()) {
            container.scrollTop = lastScrollHeight;
        }
    });
    for (const child of container.children) {
        observer.observe(child);
    }
};

function isScrolledToBottom(container) {
    lastScrollHeight = lastScrollHeight || container.scrollHeight

    // There can be a race between resizing and scrolling events.
    // Use the last scroll height from the resize event to figure out if we've scrolled to the bottom.
    if (!getIsScrolledToContent()) {
        if (lastScrollHeight != container.scrollHeight) {
            console.log(`lastScrollHeight ${lastScrollHeight} doesn't equal container scrollHeight ${container.scrollHeight}.`);
        }
    }

    const marginOfError = 5;
    const containerScrollBottom = lastScrollHeight - container.clientHeight;
    const difference = containerScrollBottom - container.scrollTop;

    return difference < marginOfError;
}

window.buttonCopyTextToClipboard = function(element) {
    const text = element.getAttribute("data-text");
    const precopy = element.getAttribute("data-precopy");
    const postcopy = element.getAttribute("data-postcopy");

    copyTextToClipboard(element.getAttribute("id"), text, precopy, postcopy);
}

window.copyTextToClipboard = function (id, text, precopy, postcopy) {
    const button = document.getElementById(id);

    // If there is a pending timeout then clear it. Otherwise the pending timeout will prematurely reset values.
    if (button.dataset.copyTimeout) {
        clearTimeout(button.dataset.copyTimeout);
        delete button.dataset.copyTimeout;
    }

    const copyIcon = button.querySelector('.copy-icon');
    const checkmarkIcon = button.querySelector('.checkmark-icon');
    const anchoredTooltip = document.querySelector(`fluent-tooltip[anchor="${id}"]`);
    const tooltipDiv = anchoredTooltip ? anchoredTooltip.children[0] : null;
    navigator.clipboard.writeText(text)
        .then(() => {
            if (tooltipDiv) {
                tooltipDiv.innerText = postcopy;
            }
            copyIcon.style.display = 'none';
            checkmarkIcon.style.display = 'inline';
        })
        .catch(() => {
            if (tooltipDiv) {
                tooltipDiv.innerText = 'Could not access clipboard';
            }
        });

    button.dataset.copyTimeout = setTimeout(function () {
        if (tooltipDiv) {
            tooltipDiv.innerText = precopy;
        }

        copyIcon.style.display = 'inline';
        checkmarkIcon.style.display = 'none';
        delete button.dataset.copyTimeout;
   }, 1500);
};

window.updateFluentSelectDisplayValue = function (fluentSelect) {
    if (fluentSelect) {
        fluentSelect.updateDisplayValue();
    }
}

function getThemeColors() {
    // Get colors from the current light/dark theme.
    var style = getComputedStyle(document.body);
    return {
        backgroundColor: style.getPropertyValue("--fill-color"),
        textColor: style.getPropertyValue("--neutral-foreground-rest")
    };
}

function fixTraceLineRendering(chartDiv) {
    // In stack area charts Plotly orders traces so the top line area overwrites the line of areas below it.
    // This isn't the effect we want. When the P50, P90 and P99 values are the same, the line displayed is P99
    // on the P50 area.
    //
    // The fix is to reverse the order of traces so the correct line is on top. There isn't a way to do this
    // with CSS because SVG doesn't support z-index. Node order is what determines the rendering order.
    //
    // https://github.com/plotly/plotly.js/issues/6579
    var parent = chartDiv.querySelector(".scatterlayer");

    if (parent.childNodes.length > 0) {
        for (var i = 1; i < parent.childNodes.length; i++) {
            parent.insertBefore(parent.childNodes[i], parent.firstChild);
        }
    }
}

window.updateChart = function (id, traces, xValues, rangeStartTime, rangeEndTime) {
    var chartContainerDiv = document.getElementById(id);
    var chartDiv = chartContainerDiv.firstChild;

    var themeColors = getThemeColors();

    var xUpdate = [];
    var yUpdate = [];
    var tooltipsUpdate = [];
    for (var i = 0; i < traces.length; i++) {
        xUpdate.push(xValues);
        yUpdate.push(traces[i].values);
        tooltipsUpdate.push(traces[i].tooltips);
    }

    var data = {
        x: xUpdate,
        y: yUpdate,
        text: tooltipsUpdate,
    };

    var layout = {
        xaxis: {
            type: 'date',
            range: [rangeEndTime, rangeStartTime],
            fixedrange: true,
            tickformat: "%X",
            color: themeColors.textColor
        }
    };

    Plotly.update(chartDiv, data, layout);

    fixTraceLineRendering(chartDiv);
};

window.initializeChart = function (id, traces, xValues, rangeStartTime, rangeEndTime, serverLocale) {
    registerLocale(serverLocale);

    var chartContainerDiv = document.getElementById(id);

    // Reusing a div can create issues with chart lines appearing beyond the end range.
    // Workaround this issue by replacing the chart div. Ensures we start from a new state.
    var chartDiv = document.createElement("div");
    chartContainerDiv.replaceChildren(chartDiv);

    var themeColors = getThemeColors();

    var data = [];
    for (var i = 0; i < traces.length; i++) {
        var name = traces[i].name || "Value";
        var t = {
            x: xValues,
            y: traces[i].values,
            name: name,
            text: traces[i].tooltips,
            hoverinfo: 'text',
            stackgroup: "one"
        };
        data.push(t);
    }

    // Explicitly set the width and height based on the container div.
    // If there is no explicit width and height, Plotly will use the rendered container size.
    // However, if the container isn't visible then it uses a default size.
    // Being explicit ensures the chart is always the correct size.
    var width = parseInt(chartContainerDiv.style.width);
    var height = parseInt(chartContainerDiv.style.height);

    var layout = {
        width: width,
        height: height,
        paper_bgcolor: themeColors.backgroundColor,
        plot_bgcolor: themeColors.backgroundColor,
        margin: { t: 0, r: 0, b: 40, l: 50 },
        xaxis: {
            type: 'date',
            range: [rangeEndTime, rangeStartTime],
            fixedrange: true,
            tickformat: "%X",
            color: themeColors.textColor
        },
        yaxis: {
            rangemode: "tozero",
            fixedrange: true,
            color: themeColors.textColor
        },
        hovermode: "x",
        showlegend: true,
        legend: {
            orientation: "h",
            font: {
                color: themeColors.textColor
            },
            traceorder: "normal",
            itemclick: false,
            itemdoubleclick: false
        }
    };

    var options = { scrollZoom: false, displayModeBar: false };

    Plotly.newPlot(chartDiv, data, layout, options);

    fixTraceLineRendering(chartDiv);
};

function registerLocale(serverLocale) {
    // Register the locale for Plotly.js. This is to enable localization of time format shown by the charts.
    // Changing plotly.js time formatting is better than supplying values from the server which is very difficult to do correctly.

    // Right now necessary changes are to:
    // -Update AM/PM
    // -Update time format to 12/24 hour.
    var locale = {
        moduleType: 'locale',
        name: 'en',
        dictionary: {
            'Click to enter Colorscale title': 'Click to enter Colourscale title'
        },
        format: {
            days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            shortDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            shortMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            periods: serverLocale.periods,
            dateTime: '%a %b %e %X %Y',
            date: '%d/%m/%Y',
            time: serverLocale.time,
            decimal: '.',
            thousands: ',',
            grouping: [3],
            currency: ['$', ''],
            year: '%Y',
            month: '%b %Y',
            dayMonth: '%b %-d',
            dayMonthYear: '%b %-d, %Y'
        }
    };
    Plotly.register(locale);
}

function isActiveElementInput() {
    const currentElement = document.activeElement;
    // fluent components may have shadow roots that contain inputs
    return currentElement.tagName.toLowerCase() === "input" || currentElement.tagName.toLowerCase().startsWith("fluent") ? isInputElement(currentElement, false) : false;
}

function isInputElement(element, isRoot, isShadowRoot) {
    const tag = element.tagName.toLowerCase();
    // comes from https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event
    // fluent-select does not use <select /> element
    if (tag === "input" || tag === "textarea" || tag === "select" || tag === "fluent-select") {
        return true;
    }

    if (isShadowRoot || isRoot) {
        const elementChildren = element.children;
        for (let i = 0; i < elementChildren.length; i++) {
            if (isInputElement(elementChildren[i], false, isShadowRoot)) {
                return true;
            }
        }
    }

    const shadowRoot = element.shadowRoot;
    if (shadowRoot) {
        const shadowRootChildren = shadowRoot.children;
        for (let i = 0; i < shadowRootChildren.length; i++) {
            if (isInputElement(shadowRootChildren[i], false, true)) {
                return true;
            }
        }
    }

    return false;
}

window.registerGlobalKeydownListener = function (shortcutManager) {
    function hasNoModifiers(keyboardEvent) {
        return !keyboardEvent.altKey && !keyboardEvent.ctrlKey && !keyboardEvent.metaKey && !keyboardEvent.shiftKey;
    }

    // Shift in some but not all, keyboard layouts, is used for + and -
    function modifierKeysExceptShiftNotPressed(keyboardEvent) {
        return !keyboardEvent.altKey && !keyboardEvent.ctrlKey && !keyboardEvent.metaKey;
    }

    function calculateShortcut(e) {
        if (modifierKeysExceptShiftNotPressed(e)) {
            /* general shortcuts */
            switch (e.key) {
                case "?": // help
                    return 100;
                case "S": // settings
                    return 110;

                /* panel shortcuts */
                case "T": // toggle panel orientation
                    return 300;
                case "X": // close panel
                    return 310;
                case "R": // reset panel sizes
                    return 320;
                case "+": // increase panel size
                    return 330;
                case "_": // decrease panel size
                case "-":
                    return 340;
            }
        }

        if (hasNoModifiers(e)) {
            switch (e.key) {
                case "r": // go to resources
                    return 200;
                case "c": // go to console logs
                    return 210;
                case "s": // go to structured logs
                    return 220;
                case "t": // go to traces
                    return 230;
                case "m": // go to metrics
                    return 240;
            }
        }

        return null;
    }

    const keydownListener = function (e) {
        if (isActiveElementInput()) {
            return;
        }

        // list of shortcut enum codes is in src/Aspire.Dashboard/Model/IGlobalKeydownListener.cs
        // to serialize an enum from js->dotnet, we must pass the enum's integer value, not its name
        let shortcut = calculateShortcut(e);

        if (shortcut) {
            shortcutManager.invokeMethodAsync('OnGlobalKeyDown', shortcut);
        }
    }

    window.document.addEventListener('keydown', keydownListener);

    return {
        keydownListener: keydownListener,
    }
};

window.unregisterGlobalKeydownListener = function (keydownListener) {
    window.document.removeEventListener('keydown', keydownListener);
};

window.getBrowserTimeZone = function () {
    const options = Intl.DateTimeFormat().resolvedOptions();

    return options.timeZone;
};

window.focusElement = function (selector) {
    const element = document.getElementById(selector);
    if (element) {
        element.focus();
    }
};

let resourceGraph = null;

window.initializeResourcesGraph = function () {
    resourceGraph = new ResourceGraph();
    resourceGraph.resize();

    const observer = new ResizeObserver(function () {
        resourceGraph.resize();
    });

    for (const child of document.getElementsByClassName('resources-summary-layout')) {
        observer.observe(child);
    }
};

window.updateResourcesGraph = function (resources) {
    if (resourceGraph) {
        resourceGraph.updateResources(resources);
    }
};

class ResourceGraph {
    constructor() {
        this.nodes = [
            { id: "mammal", group: 0, label: "Mammals", level: 1 },
            { id: "dog", group: 0, label: "Dogs", level: 2 },
            { id: "cat", group: 0, label: "Cats", level: 2 },
            { id: "fox", group: 0, label: "Foxes", level: 2 },
            { id: "elk", group: 0, label: "Elk", level: 2 },
            { id: "insect", group: 1, label: "Insects", level: 1 },
            { id: "ant", group: 1, label: "Ants", level: 2 },
            { id: "bee", group: 1, label: "Bees", level: 2 },
            { id: "fish", group: 2, label: "Fish", level: 1 },
            { id: "carp", group: 2, label: "Carp", level: 2 },
            { id: "pike", group: 2, label: "Pikes", level: 2 }
        ];

        this.links = [
            { target: "mammal", source: "dog", strength: 0.7 },
            { target: "mammal", source: "cat", strength: 0.7 },
            { target: "mammal", source: "fox", strength: 0.7 },
            { target: "mammal", source: "elk", strength: 0.7 },
            { target: "insect", source: "ant", strength: 0.7 },
            { target: "insect", source: "bee", strength: 0.7 },
            { target: "fish", source: "carp", strength: 0.7 },
            { target: "fish", source: "pike", strength: 0.7 },
            { target: "cat", source: "elk", strength: 0.1 },
            { target: "carp", source: "ant", strength: 0.1 },
            { target: "elk", source: "bee", strength: 0.1 },
            { target: "dog", source: "cat", strength: 0.1 },
            { target: "fox", source: "ant", strength: 0.1 },
            { target: "pike", source: "cat", strength: 0.1 }
        ];

        this.svg = d3.select('.resource-graph');

        // simulation setup with all forces
        this.linkForce = d3
            .forceLink()
            .id(function (link) { return link.id })
            .strength(function (link) { return 0.01 });

        this.simulation = d3
            .forceSimulation()
            .force('link', this.linkForce)
            .force('charge', d3.forceManyBody().strength(-120))
            .force("x", d3.forceX().strength(0.01))
            .force("y", d3.forceY().strength(0.01));

        this.dragDrop = d3.drag().on('start', (event) => {
            if (!event.active) {
                this.simulation.alphaTarget(0.3).restart();
            }
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }).on('drag', (event) => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }).on('end', (event) => {
            if (!event.active) {
                this.simulation.alphaTarget(0);
            }
            event.subject.fx = null;
            event.subject.fy = null;
        })

        this.svg.append("defs").selectAll("marker")
            .data(this.nodes)
            .join("marker")
            .attr("id", d => `arrow-${d.id}`)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 38)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("fill", this.getNodeColor)
            .attr("d", 'M0,-5L10,0L0,5');

        this.linkElements = this.svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(this.links)
            .enter().append("line")
            .attr("stroke-width", 1)
            .attr("stroke", "rgba(50, 50, 50, 0.2)")
            .attr("marker-end", d => `url(${new URL(`#arrow-${d.target}`, location)})`);

        this.nodeElements = this.svg.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(this.nodes)
            .enter().append("circle")
            .attr("r", 15)
            .attr("fill", this.getNodeColor)
            .call(this.dragDrop)
            .on('click', this.selectNode);

        this.textElements = this.svg.append("g")
            .attr("class", "texts")
            .selectAll("text")
            .data(this.nodes)
            .enter().append("text")
            .text(function (node) { return node.label })
            .attr("font-size", 15)
            .attr("text-anchor", "middle")
            .attr("dy", 30)
            .call(this.dragDrop)
            .on('click', this.selectNode);

        this.simulation.nodes(this.nodes).on('tick', () => {
            this.nodeElements
                .attr('cx', function (node) { return node.x })
                .attr('cy', function (node) { return node.y });
            this.textElements
                .attr('x', function (node) { return node.x })
                .attr('y', function (node) { return node.y });
            this.linkElements
                .attr('x1', function (link) { return link.source.x })
                .attr('y1', function (link) { return link.source.y })
                .attr('x2', function (link) { return link.target.x })
                .attr('y2', function (link) { return link.target.y });
        })

        this.simulation.force("link").links(this.links);

        setInterval(() => {
            for (var i = 0; i < this.nodes.length; i++) {
                this.nodes[i].label = "Test";
            }
        }, 1000);
    }

    resize() {
        var container = document.getElementsByClassName("resources-summary-layout")[0];
        var width = container.clientWidth;
        var height = Math.max(container.clientHeight - 100, 0);
        this.svg.attr("viewBox", [-width / 2, -height / 2, width, height]);
    }

    updateResources(resources) {
    }

    getNeighbors(node) {
        return this.links.reduce(function (neighbors, link) {
            if (link.target.id === node.id) {
                neighbors.push(link.source.id)
            } else if (link.source.id === node.id) {
                neighbors.push(link.target.id)
            }
            return neighbors
        },
            [node.id]);
    }

    isNeighborLink(node, link) {
        return link.target.id === node.id || link.source.id === node.id
    }


    getNodeColor(node, neighbors) {
        if (Array.isArray(neighbors) && neighbors.indexOf(node.id) > -1) {
            return node.level === 1 ? 'blue' : 'green'
        }

        return node.level === 1 ? 'red' : 'gray'
    }

    getLinkColor(node, link) {
        return this.isNeighborLink(node, link) ? 'green' : '#E5E5E5'
    }

    getTextColor(node, neighbors) {
        return Array.isArray(neighbors) && neighbors.indexOf(node.id) > -1 ? 'green' : 'black'
    }

    selectNode = (event) => {
        var selectedNode = event.target.__data__;
        var neighbors = this.getNeighbors(selectedNode)

        // we modify the styles to highlight selected nodes
        this.nodeElements.attr('fill', (node) => {
            return this.getNodeColor(node, neighbors);
        })
        this.textElements.attr('fill', (node) => {
            return this.getTextColor(node, neighbors);
        })
        this.linkElements.attr('stroke', (link) => {
            return this.getLinkColor(selectedNode, link)
        })
    }
};
