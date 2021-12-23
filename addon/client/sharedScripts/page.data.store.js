/* eslint-env browser */

// Sometimes I need to keep references to some data - e.g., computed styles (that change during replacement)

(()=>{
	function _generateId() {
		const id = Math.random().toString(36).substr(2);
		if (window.__idStore === undefined) {
			window.__idStore = {};
		}
		if (window.__idStore[id] !== undefined) {
			return _generateId(); // a non-unique id ==> try generating again
		}
		window.__idStore[id] = 1;
		return "i" + id; // prefixing with a letter, for R
	}

	function assingHiddenIdsAllEls() {
		Array.from(document.querySelectorAll("*")).forEach(el => {
			if(!el._id){
				el._id = _generateId();
			}
		});
	}
	
	function _getElId(el) {
		if (el._id === undefined) {
			console.warn("Found an element without an assigned _id, el:", window.__el2stringForDiagnostics(el));
			el._id = window._generateId();
		}
		return el._id;
	}
	
	const {getPreComputedStyles, hasPreComputedStyles} = (()=>{
		// returns getComputedStyle calculated once per element at some point, e.g., after we froze animations <-- Needed during replacement during Scramble
		var cmpStStore = {};
		const _recordStyles = (timepoint)=>{
			// initializing cmpStStore
			const stIdPairs = Array.from(document.querySelectorAll("*")).map(el=>{
				const st = window.getComputedStyle(el);
				return [window._getElId(el), window.__cssValsToObj(st, window.__getAllCssPropList())];
			});
			cmpStStore[timepoint] = Object.fromEntries(stIdPairs);
		};
		document.documentElement.addEventListener("UIFrozen", (e)=>{
			assingHiddenIdsAllEls(); // a convenient place for assigning ids
			_recordStyles("UIFrozen");
		}, false);
		document.documentElement.addEventListener("DOMPrepped", (e)=>{
			assingHiddenIdsAllEls(); // new elements have been added, so we should assign them ids
			_recordStyles("DOMPrepped");
		}, false);
		return {
			getPreComputedStyles(el, timepoint = "DOMPrepped"){
			// if cmpStStore isn't initialized, let it fall.
				if(!cmpStStore[timepoint]){
					throw "Initialize cmpStStore. Timepoint: " + timepoint;
				}
				const elId = window._getElId(el);
				if(!cmpStStore[timepoint][elId]){
					console.error("cmpStStore for ", elId, "not initialized for timepoint", timepoint, " ==> computing styles now, but debug.", window.__el2stringForDiagnostics(el));
					const st = window.getComputedStyle(el);
					cmpStStore[timepoint][elId] = window.__cssValsToObj(st, window.__getAllCssPropList());
				}
				return cmpStStore[timepoint][elId];
			},
			hasPreComputedStyles(el, timepoint = "DOMPrepped"){
				return cmpStStore[timepoint] && window._getElId(el) in cmpStStore[timepoint];
			}
		};
	})();
	
	// TODO: implement the same F for pseudo-elements
	
	// TODO: use this F in dom preparation instead of an internal solution in __wrapTextNodesInSpans/_detachPseudoElements
	function revert2PreCompStyles(elArr, timepoint = "DOMPrepped"){
		const cssInjctr = new window.CssInjector(); // I'll use a CSS injector - because by this point I don't remember what CSS I save/overwrite on top of what
		const doNotTrackProps = ["transition", "animation-play-state", "block-size"];
		elArr
			.filter(el=>hasPreComputedStyles(el, timepoint))
			.forEach(el => {
				const oldSt = getPreComputedStyles(el, timepoint);
				const newSt = window.getComputedStyle(el);
				const changedStyles = window.__getAllCssPropList({excludePrefixed: false}).filter(st => newSt[st] !== oldSt[st]).filter(x=>!doNotTrackProps.includes(x));
				if (changedStyles.length) {
					const stObj2Enforce = Object.fromEntries(changedStyles.map(st => [st, oldSt[st]]));
					cssInjctr._injectCss1Element(el, "", stObj2Enforce); // This should have enough specificity to overwrite the effects of changed siblings
					console.log("[STYLE] Reverting style to pre-computed values. Timepoint:", timepoint, window.__el2stringForDiagnostics(el), stObj2Enforce);
				}
			});
		return function cleanUpF(){
			cssInjctr._removeAllCss();
		};
	}
	
	window._getElId = _getElId;
	window._generateId = _generateId;
	window.revert2PreCompStyles = revert2PreCompStyles;
	window.getPreComputedStyles = getPreComputedStyles;
})();
