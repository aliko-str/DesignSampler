/*eslint-env browser*/
// All the ways to prepare a page for data extraction
// TODO: switch to a more-generic window.DOMutils.restoreElement(placeholderEl, realElRef) instead of the native replaceWith 


(()=>{
	function createFToggleDomPrepForInstaManip() {
		// preps DOM for manipulating elements instantaneously -- needed for, e.g., removing overlays before screenshotting some elements
		var _jqAllVis; // = $(":visible"); // keep a reference
		var state = "off";
		var chId;
		return function(onOff = "on", settings = {
			refresh: false
		}) {
			console.assert(onOff === "on" || onOff === "off");
			if (state === onOff && !settings.refresh) {
				return; // do nothing, it's already the right way
			}
			if (settings.refresh && _jqAllVis !== undefined && onOff === "on") {
				// toggling newly created elements + adding them in ref collection
				const newJqVis = $(":visible").not(_jqAllVis);
				window.__enforceManyCSSPropOnElArr(newJqVis, {"animation-play-state": "paused", "transition": "all 0s 0s"}, chId);
				_jqAllVis = _jqAllVis.add(newJqVis);
				return;
			}
			if (_jqAllVis === undefined) {
				_jqAllVis = $(":visible"); // creating a collection during the 1st call <-- Otherwise it's created when scripts are loaded, which is often before some elements are visible/loaded
			}
			// console.log("Turning transitions/animations", onOff, " for nEl:", _jqAllVis.length);
			if (onOff === "on") {
				// window.__setCSSPropJqArr(_jqAllVis, "animation-name", "none", "important");
				// Saving original computed Props for transition and animation
				_jqAllVis.toArray().forEach(el => {
					if(!el._origCmpCSS){
						const st = window.getComputedStyle(el);
						const pL = ["transition-property", "transition-duration", "transition-timing-function", "transition-delay", "animation-play-state", "transition"];
						el._origCmpCSS = window.__cssValsToObj(st, pL);	
					}
				});
				// Some animations are needed for elements to appear visible at the start -- pausing instead of removing
				console.assert(chId === undefined, "Double-assigning changeId.", location.href); // checking if we double-set this css
				chId = window.__enforceManyCSSPropOnElArr(_jqAllVis, {"animation-play-state": "paused", "transition": "all 0s 0s"});
			} else {
				window.__restoreManyCSSPropOnElArr(_jqAllVis, ["animation-play-state", "transition"], chId);
				chId = undefined;
			}
			state = onOff;
		};
	}
	
	const __isTxtNodeZeroSize = (function() {
		// to be used in __wrapTextNodesInSpans <-- because inline-block elements respect whitespace and get separated by it; we need to preserve this white space
		const range = document.createRange();
		const nonBrSpaceUniRegEx = /[\u202f\u2007\u2060\u00a0\ufeff]/;
		return (txtNode) => {
			range.selectNode(txtNode);
			const bbox = range.getBoundingClientRect();
			// NEW: for some reason zero-sized nonBreakingSpace Unicode characters participate in layout drawing -- we'll have to keep them
			return bbox.width * bbox.height === 0 && !nonBrSpaceUniRegEx.test(txtNode.nodeValue);
		};
	})();


	function __handleFlexBr(aControlEl, nonTxtChildEls){
		// flexbox doesn't respect br, but text nodes do -- we need an extra span to keep text nodes in during wrapping
		const cntrlSt = window.getComputedStyle(aControlEl);
		if(cntrlSt.display.includes("flex") && nonTxtChildEls.some(el=>el.tagName.toLowerCase() === "br")){
			const elRuns = [[]]; // because we only want contigous runs of text+br to be wrapped in their spans - otherwise we just keep elements untouched
			for(const child of aControlEl.childNodes){
				if(child.nodeType === document.TEXT_NODE || (child.nodeType === document.ELEMENT_NODE && child.tagName.toLowerCase() === "br")){
					elRuns[elRuns.length-1].push(child);
				}else{
					elRuns.push([]); // adding an array to save another run
				}
			}
			// filtering out non-runs
			//NOTE: checking for document.ELEMENT_NODE is enough -- we only take <br> Elements
			elRuns.filter(elRun=>elRun.length > 2 && elRun.some(x=>x.nodeType===document.ELEMENT_NODE)).forEach((elRun, i) => {
				console.warn("[WRAP] Flex-box text/br items are wrapped in their span");
				const span = window.__makeCleanSpan();
				span._origElTag = aControlEl.tagName;
				aControlEl.insertBefore(span, elRun[0]);
				elRun.forEach((item, i) => span.append(item));	
				// FIXME: Save these changes, so they can be rolled back				
			});
		}
	}
	
	const {
		__wrapTextNodesInSpans,
		__unwrapTextNodesFromSpans
	} = (function() {
		const changesStore = [];
		const cssInjctr = new window.CssInjector();
		// const allStKeys = [... window.getComputedStyle(document.documentElement)];
		function ___revertStyleChanges(el, oldStObj, oldStObjPseudo) {
			// window.injectCss
			// debugger;
			const newStObj = window.getComputedStyle(el);
			// find what's changed about an element
			const changedStyles = window.__getAllCssPropList().filter(st => newStObj[st] !== oldStObj[st]);
			if (changedStyles.length) {
				const stObj2Enforce = Object.fromEntries(changedStyles.map(st => [st, oldStObj[st]]));
				window.__enforceCSSVals(el, stObj2Enforce);
			}
			// repeat the same for pseudo elements
			Object.entries(oldStObjPseudo).map(([pseudoKey, stObj]) => {
				const pStObj = window.getComputedStyle(el, pseudoKey);
				const psChangedStyles = window.__getAllCssPropList().filter(st => pStObj[st] !== stObj[st]);
				if (psChangedStyles.length) {
					const psStObj2Enforce = Object.fromEntries(psChangedStyles.map(st => [st, stObj[st]]));
					cssInjctr._injectCss1Element(el, pseudoKey, psStObj2Enforce);
					// // we can't use the style prop --> creating a css rule instead
					// if(!el.id || !el.id.length){
					// 	el.id = window._generateId();
					// }
					// cssInjctr._injectCss("#"+el.id+pseudoKey, psStObj2Enforce);
				}
			});
		}
		function* ___alAncestorsInArr(el){
			yield el.tagName.toLowerCase();
			while((el = el.parentElement) !== null){
				yield el.tagName.toLowerCase();
			}
		}
		function ___checkIfWhSpaceShouldBeAlwaysKept(aControlEl){
			// checking if whiteSpace should be not removed -- Using a blanket approach instead of specific ones for each "white-space" value because it's a bit too many conditions/exceptions/gray areas
			// 1 - Check if it's wrapped in <pre>
			const ifItsInPre = Array.from(___alAncestorsInArr(aControlEl)).find(x=>x === "pre") !== undefined;
			// 2 - Check element's white-space CSS
			const st = window.getComputedStyle(aControlEl);
			const ifCssPreSet = st["white-space"] !== "normal" && st["white-space"] !== "nowrap";
			return ifItsInPre || ifCssPreSet;
		}
		return {
			// NOTE: I may have to save all computed styles before any changes -- technically not just siblings can affect rules -- see if this comes up in practice
			__wrapTextNodesInSpans: function(aControlEl) {
				// ATTENTION: This permanently modifies the original HTML - Only inteded for invisible text to stay undetected, e.g., in folded <details>
				// We're saving a reference to the original non-text nodes in aControlEl, so we can check for any style changes to them due to DOM alteration
				const nonTxtChildEls = Array.from(aControlEl.childNodes).filter(el => el.nodeType === document.ELEMENT_NODE);
				const nonTxtChildElStyles = nonTxtChildEls.map(el => window.__cssValsToObj(window.getComputedStyle(el), window.__getAllCssPropList())); // We copy styles in a non-live object, so they don't change with an element
				// also copy styles for pseudoElements
				const nonTxtChildElPseudoStyles = nonTxtChildEls.map(el => {
					return {
						"::before": window.__cssValsToObj(window.getComputedStyle(el, "::before"), window.__getAllCssPropList()),
						"::after": window.__cssValsToObj(window.getComputedStyle(el, "::after"), window.__getAllCssPropList())
					};
				});
				// looking for items to wrap
				const txtChildEls = Array.from(aControlEl.childNodes).filter(el => {
					return el.nodeType === document.TEXT_NODE;
				});
				// handling a special case of flexbox + <br>
				__handleFlexBr(aControlEl, nonTxtChildEls);
				// actual replacement
				const _preH = window.getScrlEl().scrollHeight;
				// checking if white-space should be not removed, even if it's zero-sized
				const ifKeepWhSpace = ___checkIfWhSpaceShouldBeAlwaysKept(aControlEl);
				// ensuring end-of-line white spaces aren't zero-sized --- otherwise we sometimes have text shifts when we remove it
				const _oldWhSp = aControlEl.style.getPropertyValue("white-space");
				const _oldWhSpPriority = aControlEl.style.getPropertyPriority("white-space");
				aControlEl.style.setProperty("white-space", "nowrap", "important"); // puts all in 1 line -- no end-of-line zeroing
				// replacing
				txtChildEls.forEach((el, i) => {
					// const _origHeight = window.getScrlEl().scrollHeight;
					if (!ifKeepWhSpace && !el.nodeValue.trim().length && __isTxtNodeZeroSize(el)) {
						// this an empty, whitespace text node --> remove it
						el.remove();
					} else {
						const span = window.__makeCleanSpan();
						span.textContent = el.nodeValue;
						span._origElTag = aControlEl.tagName;
						el.replaceWith(span);
						changesStore.push({
							el: el,
							span: span
						});
					}
					// NOTE: only enable when investigating
					// if(_origHeight !== window.getScrlEl().scrollHeight){
					// 	debugger;
					// 	console.error("scrollingElement.scrollHeight has changed.", _origHeight, window.getScrlEl().scrollHeight, window.__el2stringForDiagnostics(aControlEl));
					// }
				});
				// cancelling out our changes to CSS white space handling
				aControlEl.style.setProperty("white-space", _oldWhSp, _oldWhSpPriority);
				// checking for changes in neighboring elements -- could happen if, e.g., CSS uses element-specific padding/margins
				if (txtChildEls.length && nonTxtChildEls.length) { // if there was smth to be changed/affected
					nonTxtChildEls.forEach((el, i) => ___revertStyleChanges(el, nonTxtChildElStyles[i], nonTxtChildElPseudoStyles[i]));
				}
				if (_preH !== window.getScrlEl().scrollHeight) {
					debugger;
					console.error("scrollingElement.scrollHeight has changed.", _preH, window.getScrlEl().scrollHeight, window.__el2stringForDiagnostics(aControlEl));
				}
				return aControlEl;
			},
			__unwrapTextNodesFromSpans: function() {
				var pair;
				while ((pair = changesStore.pop()) !== undefined) {
					pair.span.replaceWith(pair.el);
				}
				console.assert(!changesStore.length, "We haven't restored some textNodes back from spans!", window.location.href);
				cssInjctr._removeAllCss();
			}
		};
	})();
	
	
	const {
		_detachPseudoElements,
		_reattachPseudoElements
	} = (() => {
		const cssInjctr = new window.CssInjector();
		const addedElements = [];
		return {
			_detachPseudoElements() {
				// NOTE: I'll only do this for bgImg 
				// FIXME: Collect all pseudoRelated pre-processing here
				// NOTE: we only do this for after/before
				$("html").find(":visible").not("iframe").toArray().forEach((el, i) => {
					[true, false].forEach((ifBefore, i) => {
						const pseudoKey = ifBefore ? "::before" : "::after";
						const addF = ifBefore ? "prepend" : "append";
						const st = window.getComputedStyle(el, pseudoKey);
						if(st["content"] !== "none"){ // "content: none" is the only unique-to-pseudoEls way to hide
							const hasContent = window.__testPseudoContentForIcons(el, "doesntmatter", st["content"]);
							const hasRealChildren = el.childNodes.length > 0;
							// st["content"].indexOf("url(") > -1
							if (st["background-image"].indexOf("url(") > -1 || (hasContent && hasRealChildren)) {
								// we have a background image -- do replacement
								// 0 - Make span
								const span = window.__makeCleanSpan();
								// 1 - Textual content doesn't show up in non-PseudoElements --> insert it as strings in clean spans
								if(hasContent === window.graphTypes.glyph){
									span.__wasPseudoEl = true;
									span.__pseudoType = hasContent; // Leave a flag for us to not include this span in text collections -- it should be an image
									span.__pseudoPrx = pseudoKey;
									span.textContent = st.content.replaceAll(/["']/g, "");
								}
								span._origElTag = el.tagName.toLowerCase() + pseudoKey;
								// 2 - add our span in DOM
								el[addF](span);
								addedElements.push(span);
								// 3 - copy up styles on an empty span
								const oldSt = window.getPreComputedStyles(el, "NoShadowDOM", pseudoKey);
								// const oldSt = window.getPreComputedStyles(el, "UIFrozen", pseudoKey);
								const stToEnf = window.stripIdenticalCss(oldSt, window.getComputedStyle(span));
								// const stToEnf = window.__cssValsToObj(st, window.__getAllCssPropList());
								// 3.1 - NEW extra -- SVG contents don't scale properly --> keep them as pseudoElements
								if(st["content"].indexOf(".svg") > -1 || st["content"].indexOf("</svg>") > -1){
									span.classList.remove("__clean-span");
									span.classList.add("__clean-span-for-svg");
									span.__pseudoHasImg = true; // not great (pseudoElement can be positioned -- getBoundingClientRect won't work properly), but I don't see other solutions
									cssInjctr._injectCss1Element(span, pseudoKey, stToEnf);
								}else{
									window.__enforceCSSVals(span, stToEnf);
								}
								// 4 - make a pseudo element invisible
								cssInjctr._injectCss1Element(el, pseudoKey, {"display": "none !important"});
								console.log("[ALTERATION] Extracted a pseudo bgImg in a span", pseudoKey, window.__el2stringForDiagnostics(el));
								// }
							}	
						}
					});
				});
			},
			_reattachPseudoElements(){
				cssInjctr._removeAllCss();
				addedElements.forEach(el=>el.remove());
			}
		};
	})();

	// FIXME: REVERT changes before HTML saving
	function __makeCrossOrigStylesheetsAccessible() {
		Array.from(document.getElementsByTagName("link")).filter(linkEl => linkEl.rel === "stylesheet").filter(linkEl => {
			// checking for media queries -- only applied stylesheets need to be internalized -- if not applied, remove
			if (!window.matchMedia(linkEl.media).matches) {
				linkEl.remove();
				return false;
			}
			
			return true;
		}).filter(linkEl => {
			// only external stylesheets need this modifications
			return !linkEl.href.startsWith(window.location.origin) && linkEl.href.indexOf("http") === 0;
		}).forEach(linkEl => {
			// linkEl.setAttribute("crossOrigin", "anonymous");
			const linkTmpl = `<style type="text/css">@import url("${linkEl.href}");</style>`;
			const newLinkEl = $(linkTmpl)[0];
			linkEl.replaceWith(newLinkEl);
			// linkEl.remove();
			// document.head.appendChild(newLinkEl);
			console.warn("An external stylesheet detected:", linkEl.href, "WHILE AT", window.location.href);
		});
	}
	
	const {hideInvisFixedEls, unhideInvisFixedEls} = (()=>{
		// Fixed elements that are moved outside viewport are never visible to the user, but appear on our full-page screenshots -- Hide them
		const cssInjctr = new window.CssInjector();
		var elsToHide, elsToShow;
		return {
			hideInvisFixedEls(){
				// 1 - Find fixed els, with containing block being Viewport <-- FF only solution
				const fixedEls = $(":visible").not("html, body").toArray()
					.filter(el=>{
						// not empty -- an improvement upon ":visible"
						const b = el.getBoundingClientRect();
						return b.height > 1 && b.width > 1;
					})
					.filter(el=>{
						return window.getComputedStyle(el).position === "fixed" && document.body.isSameNode(el.offsetParent);
					});
				// 2 - Find fixed els outside viewport
				const outsideViewportFixedEls = fixedEls.filter(window._isItOutsideTopViewport);
				// 2.1 - fixed elements can still have things in a new drawing context, positioned above the fold -- check each descendant individually
				const jqFixedInsides = $(outsideViewportFixedEls).find(":visible");
				const jqVisibleFixedInsides = jqFixedInsides.filter((i, el)=>!window._isItOutsideTopViewport(el));
				elsToHide = jqFixedInsides.not(jqVisibleFixedInsides).add(outsideViewportFixedEls).toArray();
				elsToShow = jqVisibleFixedInsides
					.toArray()
					.filter((el, i, arr)=>{
						// excluding nested elements -- they'll inherit "visible" from their parents <-- a minor optimization
						return arr.every(anotherEl=>anotherEl.isSameNode(el) || !anotherEl.contains(el));
					});
				// 3 - Hide/Show
				if(elsToHide.length){
					debugger;
					console.log("[ALTER] Hiding fixed Nodes outside the viewport, n: ", outsideViewportFixedEls.length, location.href);
					outsideViewportFixedEls.forEach(el => console.log(window.__el2stringForDiagnostics(el)));
					elsToHide.forEach(el => cssInjctr._injectCss1Element(el, "", {"visibility": "hidden !important"}));
					// window.__setCSSPropJqArr(elsToHide, "visibility", "hidden", "important");
					if(elsToShow.length){
						elsToShow.forEach(el => cssInjctr._injectCss1Element(el, "", {"visibility": "visible"}));
						// window.__setCSSPropJqArr(elsToShow, "visibility", "visible", "important");
					}
				}
			},
			unhideInvisFixedEls(){
				cssInjctr._removeAllCss();
				// if(elsToHide && elsToShow){
				// 	window.__restoreCSSPropJqArr(elsToHide.concat(elsToShow), "visibility");
				// }
				// elsToHide = null;
				// elsToShow = null;
			}
		};
	})();
	
	const {_marquee2div, _restoreMarquee} = (()=>{
		const marqueeDivPairs = [];
		return {
			_marquee2div(){
				$("marquee:visible").toArray().forEach(mrq => {
					const hasVisNodes = Array.from(mrq.childNodes).some(x=>(x.nodeType === document.TEXT_NODE &&  x.nodeValue.trim().length) || x.nodeType === document.ELEMENT_NODE);
					if(!hasVisNodes){
						return; // no point replacing - this marquee has no content to scroll anyway
					}
					// const div = document.createElement("div");
					const div = window.__makeCleanDiv();
					const mrqSt = window.__cssValsToObj(window.getComputedStyle(mrq), window.__getAllCssPropList());
					mrq.childNodes.forEach(subNode => {
						const clone = subNode.cloneNode(true); // NOTE: cloneNode will likely fail for custom Elements -- we disable their js upstream <-- let's hope it's rare
						// const clone = __cloneNodeF(subNode);
						// if(subNode.nodeType === document.ELEMENT_NODE){
						// 	clone._id = window._getElId(subNode);
						// }
						div.appendChild(clone);
					});
					// re-attach our generated ids to the cloned children -- all of them, not just direct children
					const mrqClonedDescendants = Array.from(div.querySelectorAll("*")).map(el=>{
						el._id = el.dataset.elGenId;
						console.assert(el._id);
						return el;
					});
					mrq.replaceWith(div);
					const divStToEnf = window.stripIdenticalCss(mrqSt, window.getComputedStyle(div));
					Object.assign(divStToEnf, {"overflow": "hidden", "overflowX": "hidden", "overflowY": "hidden"});
					window.__enforceCSSVals(div, divStToEnf);
					debugger;
					window.revert2PreCompStyles(mrqClonedDescendants, "NoShadowDOM");
					// window.revert2PreCompStyles(mrqClonedDescendants, "UIFrozen");
					marqueeDivPairs.push({mrq: mrq, div: div});
					// making sure that div has at least some text <-- so line-height is respected on the parent
					const hasVisTxtNodes = div.innerText.trim().length;//Array.from(div.childNodes).some(x=>x.nodeType === document.TEXT_NODE);
					if(!hasVisTxtNodes){
						const span = window.__makeCleanSpan();
						span.innerText = ".";
						span.style.color = "transparent";
						div.appendChild(span);
					}
					console.log("[PREPPING] %cReplacing <marquee> with a <div>", "color:lightblue;");
				});
			},
			_restoreMarquee(){
				marqueeDivPairs.forEach(pair => pair.div.replaceWith(pair.mrq));
				marqueeDivPairs.length = 0;
			}
		};
	})();
	
	const {removeNoScript, readdNoScript} = (()=>{
		// NOTE: these affect neighbour-based CSS -- too much hustle for too little benefit -- Abandon for now
		const noScriptStore = [];
		return {removeNoScript: ()=>{
			document.body.querySelectorAll("noscript").forEach((el, i) => {
				const aDiv = window.__makeInvisDiv();
				noScriptStore.push({noscript: el, div: aDiv});
				el.replaceWith(aDiv);
			});
			console.log("[MODDING] Removed noscripts");
		}, readdNoScript: ()=>{
			var pair;
			while(pair = noScriptStore.shift()){
				pair.div.replaceWith(pair.noscript);
			}
			console.log("[MODING] Reattached noscripts");
		}};
	})();
	
	function __wrapNakedTxtNodesInSpans() {
		// If a parent has non-text nodes and direct-text nodes, wrap direct-text nodes in spans -- otherwise they can't be recorded as 'primitives', and we have a mess identifying a semantic-group membership + Problems with Hierarchical clustring
		// 1 - Get all elements -- we should do it before detecting all visible else
		const jqAll = $("html").find(":visible"); // some primitive visibility detection
		// 1.1	- Removing comments from HTML - they aren't rendered, but counted in childNodes (and I rely on it being not there... I should instead simply check node type every time, but removing is easier)
		jqAll.each((i, el)=>{
			Array.from(el.childNodes).filter(subEl=>subEl.nodeType === document.COMMENT_NODE).forEach(subEl => {
				console.log("[REMOVING] a comment node: ", subEl.nodeValue);
				subEl.remove();
			});
		});
		// 2 - Handle the weird case of expandable <details> <-- their folded content shouldn't later found as visible, and wrapping them in a span should do the trick with BBox size check below
		jqAll.filter("details").each((i, el) => {
			__wrapTextNodesInSpans(el);
		});
		// 3 - Wrap other naked text nodes
		jqAll.not("details").each((i, el) => {
			if (el.children.length === el.childNodes.length) {
				return; // All children are elements
			}
			if (!el.childNodes.length) {
				return; // No elements at all
			}
			if (!el.children.length) {
				// All children are text
				// NEW extra: Normalizing -- so no text nodes are empty or direct siblings
				el.normalize(); // we do it here, because documentElement.normalize() changes smth big sometimes, and I'm not sure what -- so minimizing its impact by bringing its effects down the HTML tree
				const bgImg = window.getComputedStyle(el).getPropertyValue("background-image");
				if (bgImg.indexOf("url(") === -1) {
					return;
				}
				// else we need to detach bgImg from text
				console.log("A text node with bgImg detected -- detaching text from img", window.__el2stringForDiagnostics(el));
			}
			__wrapTextNodesInSpans(el);
		});
	}
	
	function noopF(){};
	
	// TODO: repeat for background-color?..
	// TODO: repeat for width?..
	function ensureBaseCanvasVisible(){
		// checks for the rare cases of body/html being technically empty (e.g., floats or absolute positioning), while having bgImg/bgCol -- the page-underlying canvas inherits them, but it's not recorded (since that canvas has no corresponding DOM element)
		const htmlH = document.documentElement.getBoundingClientRect().height;
		const bodyH = document.body.getBoundingClientRect().height;
		const scrollH = window.getScrlEl().scrollHeight;
		if(htmlH < (scrollH-1) && bodyH < (scrollH-1)){ // if both of them are less than the scrollElement height
			const htmlHasBg = window.getComputedStyle(document.documentElement)["background-image"] !== "none"; // I won't be checking for other ways to have replaced content -- hopefully it's too rare
			const bodyHasBg = window.getComputedStyle(document.body)["background-image"] !== "none";
			const el2setHeightOn = htmlHasBg?document.documentElement:(bodyHasBg?document.body:null);
			if(el2setHeightOn){
				const h = scrollH + "px";
				const chId = window.__setCSSPropJqArr([el2setHeightOn], "height", h, "important");
				if(scrollH < window.getScrlEl().scrollHeight){
					// some of body/html children had min-height depending on body/html height --> set h to viewport height (still no longer invisible body/html bg image, but it also is no longer replicated along the entire length of page - it's a semi-solution, should work for most cases)
					window.__setCSSPropJqArr([el2setHeightOn], "height", "100vh", "important", chId);
				}
				return ()=>{
					window.__restoreCSSPropJqArr([el2setHeightOn], "height", chId);
				};
			}
		}
		return noopF;
	}
	
	function _cheapFilter2Visible(el){
		const st = window.getComputedStyle(el);
		const o = parseFloat(st.opacity);
		const b = el.getBoundingClientRect();
		console.assert(!isNaN(o), "[shadowDom2IFrames] Opacity parsing failed:", o, st.opacity);
		return st.visibility === "visible" && st.display !== "none" && o > 0.1 && (b.width > 1 && b.height > 1);
	}
	
	const {prepDomForDataExtractionAsync, restoreDomAfterDataExtraction} = (()=>{
		var _cleanUpStyleReversingF, _restoreBodyHF;
		return {
			restoreDomAfterDataExtraction() { // safe to call even if DOM hasn't been altered
				__unwrapTextNodesFromSpans(); // currently nothing but this
				_reattachPseudoElements();
				unhideInvisFixedEls();
				_restoreMarquee();
				_cleanUpStyleReversingF(); // if it's not assigned, let it fall and debug
				// readdNoScript();
				_restoreBodyHF();
				// restoreShadowDom(); // fuck it, not restoring after shadow dom unwrapping -- too much hastle
			},
			prepDomForDataExtractionAsync(diffCheckNeeded = false) {
				console.log("%c[PREPPING] Staring on:%s", "background-color:gray;", location.href);
				// some permanent alterations to DOM needed for our Data Extractions
				var outRes = null;
				// const allEls = Array.from(document.body.querySelectorAll("*"));
				const elsToTrackCssFor = window.findElsStyledByOrder().concat(window.findElsStyledByCrucialAttrs());
				console.log("[PREPPING] N els to reverse changes to (cause styled by tree-based selectors):", elsToTrackCssFor.length);
				// // 3.3 - Removing <noscript> so they don't affect our lists of invisible elements
				// removeNoScript();
				// 1 - make dom maniplation instant -- so out diff checks actually pick them up <== We should do that prior to screenshot taking - otherwise comparisons show a diff due to animations
				window.toggleDomPrepForInstaManip("on");
				if (diffCheckNeeded) {
					// 1.1 - Take a full-page screeonshot 
					var pageCnvsBefore = window.getStoredFullPageCanvas(); // window.page2Canvas(true);
					// jqG.origPageCnvs = pageCnvsBefore; // saving for the future use
				}
				// return Promise.resolve()
				const separateChangeTracking4ShadowDom = false;
				return window.unwrapShadowDomAsync(separateChangeTracking4ShadowDom)
					.then(()=>window._alarmPr(1000))
					.then(()=>{
						// 2.-1 - If needed, expand html/body height to capture the page-underlying canvas bgImg
						_restoreBodyHF = ensureBaseCanvasVisible();
						// 2 - Prep stylesheets
						__makeCrossOrigStylesheetsAccessible();
						// 3.0 - Replacing marquee with divs
						_marquee2div(); // cause marquee causes trouble and often has no text, looking broken/empty
						// 3.1 - Extract pseudo graphics in separate elements
						_detachPseudoElements(); // this generates new <spans>, which affects what needs wrapping -- do it before wrapping
					})
					.then(()=>window._alarmPr(350)) // a small delay to finish UI reflows after PseudoElement extraction -- to avoid false style restorations)
					.then(()=>{
						// 3.2 - Do alterations
						__wrapNakedTxtNodesInSpans();
						// A bit of time for reflow to happen - otherwise we have false-flag differences
						// 3.3 - Hide outsideViewport fixed els <== TODO: move before taking 1st canvas to avoid false flags <-- after a debug
						hideInvisFixedEls();
						// 3.4 - appling CSS that no longer applies due to nth-child and nth-of-type being messed up (because of our element inserting above)
						_cleanUpStyleReversingF = window.revert2PreCompStyles(elsToTrackCssFor, "NoShadowDOM");
						// _cleanUpStyleReversingF = window.revert2PreCompStyles(elsToTrackCssFor, "UIFrozen");						
					})
					.then(()=>window._alarmPr(300))
					.then(()=>{
						// 4 - Take another screenshot and compare/save the difference -- there should be any
						if (diffCheckNeeded) {
							var pageCnvsAfter = window.page2Canvas(true);
							const diffThr = 2;
							const {
								sizeDiff,
								wDiff,
								hDiff,
								canvasesAreSame,
								diffCnvs,
								accuDiff
							} = window.getCnvsDiff(pageCnvsBefore, pageCnvsAfter, diffThr);
							if (!canvasesAreSame) {
								debugger;
								// 4.1 - if needed, refreshing our saved canvas
								const ifForceRefresh = true;
								window.getStoredFullPageCanvas(ifForceRefresh);
							}
							console.assert(canvasesAreSame, "Visual Difference after manipulation, total size diff in pixels:", sizeDiff, "wDiff: ", wDiff, "hDiff:", hDiff, "total pixel value Diff: ", accuDiff, window.location.href);
							// TODO log differences in console
							outRes = {
								accuDiff: accuDiff,
								diffCnvs: diffCnvs
							};
						}
						// 5.1 - Clean up
						window.toggleDomPrepForInstaManip("on", {
							refresh: true
						}); // refreshing due to us adding spans
						// window.toggleDomPrepForInstaManip("off", {
						// 	refresh: true
						// }); // refreshing due to us adding spans
						// 5.2 - ensuring getAllVis collections are refreshed
						window.domGetters.forceRefresh();
						// jqG.__elStore.allVis = null;							
						// 5.4 - Saving computed styles for all visible elements
						document.documentElement.dispatchEvent(new Event("DOMPrepped"));
						console.log("DONE PREPPING", location.href);
						// resolve(outRes);
						return outRes;							
					});
			}	
		};
	})();
	
	function _lineUpShadowRoot(startingEl){
		// finding all shadow roots and putting them in a linear array -- nested, lower-level roots first
		// 1 - retrieve shadow roots for this level
		//document.body
		return Array 
			.from(startingEl.querySelectorAll(":not(svg *)")) // <== omitting <svg> insides; <use> for some reason produces a shadow root
			.filter(el=>el.openOrClosedShadowRoot)
			.filter(el=>!window._tagSets.builtinWithShadowDom.has((el.tagName || "").toLowerCase())) // filtering out elements with ShadowDom by default (for some reason it's visible to addons with openOrClosedShadowRoot -- but only while the el is attached do the document)
			// .filter(_cheapFilter2Visible)
			.filter(el=>el.openOrClosedShadowRoot.querySelectorAll(":not(style)").length)
			.sort((a, b)=>{
				if(a.contains(b)){
					return 1;
				}else if(b.contains(a)){
					return -1;
				}
				return 0;
			}) // cause to-be-slotted elements can also have shadow roots -- they aren't visible until they are slotted (so we )
			.map(el => {
				// 2 - if there are nested shadow roots, run recursion...
				const nestedRoots = _lineUpShadowRoot(el.openOrClosedShadowRoot);
				nestedRoots.push(el); // adding current root as the last element
				return nestedRoots;
			})
			.flat(1);
	}
	
	// NEW approach: line up shadow roots; do slotting, record els to restore (incl in shadowHosts); repl shadowHosts with divs, record all els to restore
	// NOTE: restoring ShadowDom manipuations may not be possible -- it'd require running custom-element constructors, which may well no longer work.
	
	function _getAllShadowDomAffectedNodes(shadowRoots){
		// 1 - get all slotted els
		// 1.1 - get all <slot>s
		const slots = shadowRoots
			.map(rootEl=>Array.from(rootEl.openOrClosedShadowRoot.querySelectorAll("slot")))
			.flat(1);
		// 1.2 - link assigned nodes
		const assndNodes = slots
			.filter(aSlot=>aSlot.assignedNodes().length) // cause some <slot>s aren't assigned anything - Isn't it joy working through some retard's code?..
			.map(aSlot=>{
				const assndNodesAndChildren = Array
					.from(aSlot.assignedNodes())
					.filter(el=>el.nodeType === document.ELEMENT_NODE) // assigned nodes can be non-Element nodes (e.g., text)
					.map(el=>Array.from(el.querySelectorAll("*")).concat([el])) // selecting all cause even in-svg elements can be styled with CSS
					.flat(1);
				// NOTE: there may be shadowRoots inside assignedNodes (and they would be invisible to querySelectorAll above) - but we don't need to collect them here --> they and their contents will be tracked for changes anyway below.
				return assndNodesAndChildren;
			})
			.flat(1);
		// 2 - shadow roots and their contents + their siblings (which may be affected by the order-based styling); NOTE: keeping all siblings for restoring is just simpler than looking through nested styles for order-based selectors
		const shadowRootDescendants = shadowRoots
			.map(x=>x.openOrClosedShadowRoot.querySelectorAll(":not(style)")) // no need to check for nestedness -- nested shadowRoots are already collected
			.map(x=>Array.from(x))
			.flat(1);
		const shadowRootSiblings = shadowRoots
			.map(x=>x.parentElement)
			.filter(x=>x)
			.map(x=>x.children) // already contains original shadowRoots
			.map(x=>Array.from(x))
			.flat(1);
		// 3 - a unique-element collection to track changes for
		return Array.from(new Set(assndNodes.concat(shadowRootSiblings, shadowRootDescendants)));
	}
	
	function _doManualSlotting(shadowRoots){
		shadowRoots = shadowRoots || _lineUpShadowRoot(document.body);
		shadowRoots
			.map(rootEl=>Array.from(rootEl.openOrClosedShadowRoot.querySelectorAll("slot")))
			.flat(1)
			.filter(aSlot=>aSlot.assignedNodes().length) // cause some <slot>s aren't assigned anything - Isn't it joy working through some retard's code?..
			.forEach(aSlot=>{
				const assndNodes = aSlot.assignedNodes();
				aSlot.replaceWith(...assndNodes);
			});
	}
	
	function _shadowRoots2Divs(){
		const shadowRoots = _lineUpShadowRoot(document.body); // after manual slotting, the roots need to be re-searched for
		const tags2NotImportFromShadow = ["style", "link"];
		shadowRoots
			.forEach(rootEl => {
				const div = window.__makeCleanDiv();
				div.setAttribute("was-shadow-root", rootEl.tagName.toLowerCase());
				Array.from(rootEl.attributes).forEach(x=>div.setAttribute(x.name, x.value));
				const shadowContent = Array
					.from(rootEl.openOrClosedShadowRoot.childNodes)
					.filter(x=>x.nodeType !== document.ELEMENT_NODE || tags2NotImportFromShadow.every(tg=>x.tagName.toLowerCase() !== tg)) // not polluting the global scope with inShadowRoot <style>s
					.map(el=>{
						if(el.nodeType === document.ELEMENT_NODE){
							Array.from(el.querySelectorAll("style")).forEach(x => x.remove()); // checking if there are also nested styles somewhere in a shadowRoot
						}
						return el;
					});
				div.append(...shadowContent);
				rootEl.replaceWith(div);
				rootEl._replacementEl = div; // keep a reference for style restoring
			});
	}
	
	
	const {__el2styles, __restoreStyling} = (()=>{
		// const props = window.__getAllCssPropList({excludePrefixed: true})
		// 	.filter(propStr=>{ // let's only keep the simpler ones -- otherwise too high overhead with pointless props
		// 		return propStr.split("-").length < 3;
		// 	});
		const props = window.__getAllCssPropList({excludePrefixed: true}); // we'll have to keep all props -- otherwise differences creep in
		return {
			__el2styles(el){
				// const props = window.__getAllCssPropList({excludePrefixed: true});
				const outObj = Object.fromEntries(["", "::before", "::after"].map(pseudo=>["st"+pseudo, window.__cssValsToObj(window.getComputedStyle(el, pseudo), props)]));
				return Object.assign(outObj, {el});
			},
			__restoreStyling(elsAndStyles, rootEl2AppendStylesTo, settings = {enforceDiff: false}){
				// after some DOM manipulations, styles may have changed -- restore them
				const cssInjector =  new window.CssInjector(rootEl2AppendStylesTo);
				console.groupCollapsed("__restoreStyling long operation");
				elsAndStyles.forEach((elAndStyles, i) => {
					if(!(i%100)){
						console.log("[__restoreStyling] Processing element number", i+1, settings.enforceDiff?"with enforcement":" ");
					}
					const el = elAndStyles.el._replacementEl || elAndStyles.el;
					["", "::before", "::after"].forEach(pseudo => {
						const newStObj = window.__cssValsToObj(window.getComputedStyle(el, pseudo), props);
						if(pseudo && (elAndStyles["st" + pseudo].content === newStObj.content && (newStObj.content === "none" || !newStObj.content))){
							return; // speedUp -- no need to enforce anything since it's invisible
						}
						const stDiff = window.stripIdenticalCss(elAndStyles["st" + pseudo], newStObj);
						if(Object.keys(stDiff).length){
							cssInjector._injectCss1Element(el, pseudo, (settings.enforceDiff?window.__cssObj2Imp(stDiff):stDiff), {asText: false});
						}
					});
				});
				console.groupEnd();
			}
		};
	})();
	
	function unwrapShadowDomAsync(diffCheckNeeded = true){
		// 1 - getting all shadow roots -- we need access to invisible elements too for some calculations
		const shadowRoots = _lineUpShadowRoot(document.body);
		if(!shadowRoots.length){
			console.log("[unwrapShadowDomAsync] No shadow DOM roots found.", window.location.href);
			document.documentElement.dispatchEvent(new Event("NoShadowDOM"));
			return window._alarmPr(50);
			// return Promise.resolve();
		}
		console.log("[unwrapShadowDomAsync]%c FOUND Shadow DOM roots, n: " + shadowRoots.length + " " + shadowRoots.map(x=>x.tagName).join(", ") + " " + location.href, "color:#7FFFD4;");
		// debugger;
		// 2 - visual changes tracking
		if(diffCheckNeeded){
			var cnvsBefore = window.page2Canvas(true);
		}
		// 3 - get all elements that could be re-styled due to our shadowDom unwrapping
		const elsAndStyles = _getAllShadowDomAffectedNodes(shadowRoots).map(__el2styles);
		console.log("[unwrapShadowDomAsync]%c %i elements to track CSS changes for", "color:#7FFFD4;", elsAndStyles.length);
		// 4 - unwrapping
		_doManualSlotting(shadowRoots);
		_shadowRoots2Divs();
		// 5 - style restoring
		__restoreStyling(elsAndStyles);
		console.log("[unwrapShadowDomAsync] Checking for !important cases to overwrite, repeating __restoreStyling");
		__restoreStyling(elsAndStyles, undefined, {enforceDiff: true}); // because the original styles often have !important rules that we still need to overwrite
		return window._alarmPr(350) // a small delay for changes to render
			.then(()=>{
				document.documentElement.dispatchEvent(new Event("NoShadowDOM"));
			})
			.then(()=>{
				// 6 - check for visual differences
				if(diffCheckNeeded){
					const cnvsAfter = window.page2Canvas(true);
					const diffThr = 4;
					const {
						sizeDiff,
						wDiff,
						hDiff,
						canvasesAreSame,
						diffCnvs,
						accuDiff
					} = window.getCnvsDiff(cnvsBefore, cnvsAfter, diffThr);
					if (!canvasesAreSame) {
						debugger;
					}
					console.assert(canvasesAreSame, "Visual Difference after manipulation, total size diff in pixels:", sizeDiff, "wDiff: ", wDiff, "hDiff:", hDiff, "total pixel value Diff: ", accuDiff, window.location.href);
					return {
						accuDiff,
						diffCnvs
					};
				}
			});
	}
	
	function extractLocalIFramesInShadowDow(ifrEls2Replace = []){ // TODO: use for all problematic iframes that fail to communicate with the parent
		// Some iframes become completely unresponsive for some reason, after a delay -- if they are local (about:blank), put their content in a shadowRoot
		const problematicIFrameSelectors = ["#dummy-chat-button-iframe"].join(",");
		// const onlyExtractIframesForTheseWebsites = ["butlershome.ie"]; // TODO: Keep this somewhere in a profile-related config
		// Only for the top-level window/document -- at least for now
		// if(window === window.top){
		const ifrEls = ((ifrEls2Replace.length)?ifrEls2Replace:Array.from(document.querySelectorAll(problematicIFrameSelectors)))
			.filter(x=>x.tagName.toLowerCase() === "iframe")
			.filter(x=>x.contentDocument !== null); // only SameOrigin, local iframe
		console.log("[IFRAME_2_SHADOW] swapping n iframes:", ifrEls.length);
		ifrEls.forEach(ifrEl => {
			// 1 - create an empty div -- a container instead of the iframe
			const div = window.__makeCleanDiv();
			Array.from(ifrEl.attributes).forEach(x=>div.setAttribute(x.name, x.value));
			// 2 - swap iframe for the div
			ifrEl._replacementEl = div;
			// 3 - import nodes
			const stEls = Array
				.from(ifrEl.contentDocument.head.querySelectorAll("style"))
				.map(el => document.importNode(el, true));
			const bodyEls = Array
				.from(ifrEl.contentDocument.body.childNodes)
				.map(el=> document.importNode(el, true));
			// 4 - attach the nodes to a shadow root
			const shadow = div.attachShadow({mode: "open"});
			shadow.append(...stEls, ...bodyEls);
			// stEls.concat(bodyEls).forEach(el=>shadow.appendChild(el));
			// 5 - iframe replacement and style restoring
			ifrEl.replaceWith(div);
			__restoreStyling([__el2styles(ifrEl)]);
			console.log("%cReplaced an iframe with a shadowDom Div.", "background-color:#555500");
		});
		// }
	}
	
	window.extractLocalIFramesInShadowDow = extractLocalIFramesInShadowDow;
	window.unwrapShadowDomAsync = unwrapShadowDomAsync;
	window.restoreDomAfterDataExtraction = restoreDomAfterDataExtraction;
	window.prepDomForDataExtractionAsync = prepDomForDataExtractionAsync;
	window.toggleDomPrepForInstaManip = createFToggleDomPrepForInstaManip();
		
})();
