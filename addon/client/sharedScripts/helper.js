/*eslint-env browser*/
(function() {
	function rgbToLab(rgb) {
		var xyz = rgbToXyz(rgb);
		var x = xyz[0];
		var y = xyz[1];
		var z = xyz[2];
		var l;
		var a;
		var b;
		x /= 95.047;
		y /= 100;
		z /= 108.883;
		x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
		y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
		z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);
		l = (116 * y) - 16;
		a = 500 * (x - y);
		b = 200 * (y - z);
		return [l, a, b];
	};

	function rgbToXyz(rgb) {
		var r = rgb[0] / 255;
		var g = rgb[1] / 255;
		var b = rgb[2] / 255;
		// assume sRGB
		r = r > 0.04045 ? Math.pow(((r + 0.055) / 1.055), 2.4) : (r / 12.92);
		g = g > 0.04045 ? Math.pow(((g + 0.055) / 1.055), 2.4) : (g / 12.92);
		b = b > 0.04045 ? Math.pow(((b + 0.055) / 1.055), 2.4) : (b / 12.92);
		var x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
		var y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
		var z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);
		return [x * 100, y * 100, z * 100];
	}

	// const _urlRegEx = /url\((.*?)\)/;
	const _urlRegEx = /url\("(.*?)"\)/; // NOTE: only works for url() values extracted with window.getComputedStyle
	const _regNoInvis = /[  \f\n\r\t\v​\u00a0\u1680​\u180e\u2000​\u200a​\u2028\u2029\u202f\u205f​\u3000\ufeff]/gi;
	window.cleanString = function(s) {
		return s.replace(_regNoInvis, '');
	};
	
	function _urlFromCssStr(str){
		const pieces = _urlRegEx.exec(str);
		if(!pieces || pieces.length < 2){
			return null;
		}
		return pieces[1]; // no more needed to replace
		// return pieces[1].replace(/"|'/g, "");
	}

	function _getAbsBoundingRect(element) { // Not sure I use it
		const pos = element.getBoundingClientRect();
		return {
			top: pos.y + window.scrollY,
			left: pos.x + window.scrollX,
			width: pos.width,
			height: pos.height
		};
	};

	function __cpyBBox(b) {
		return {
			x: b.x,
			y: b.y,
			left: b.left,
			right: b.right,
			top: b.top,
			bottom: b.bottom,
			width: b.width,
			height: b.height
		};
	}

	function _getOuterBBox(el, settings = {
		handleFloats: false
	}) {
		const bRect = (settings.handleFloats) ? _getFloatProofBBox(el) : __cpyBBox(el.getBoundingClientRect());
		const _propsToCheck = ["marginTop", "marginLeft", "marginBottom", "marginRight"];
		const st = window.getComputedStyle(el);
		const padObjVals = {};
		_propsToCheck.forEach(prop => {
			let val = parseFloat(st[prop]);
			if (isNaN(val)) {
				console.error("A NaN value for ", prop, ":", st[prop]); // I'm not sure in what cases it'd be, since it's always supposed to resolve to a numeric value, but we should check
				val = 0;
			}
			padObjVals[prop] = val;
		});

		bRect.top -= padObjVals.marginTop;
		bRect.bottom += padObjVals.marginBottom;
		bRect.left -= padObjVals.marginLeft;
		bRect.right += padObjVals.marginRight;
		bRect.x = bRect.left;
		bRect.y = bRect.top;
		bRect.width = bRect.right - bRect.left;
		bRect.height = bRect.bottom - bRect.top;
		return bRect;
	};

	function _getInnerBBox(el, ifSkipBotPadding = false, settings = {
		handleFloats: false,
		enforceHeight2Content: false
	}) {
		// const bRect = (settings.handleFloats) ? _getFloatProofBBox(el) : __cpyBBox(el.getBoundingClientRect());
		const bRect = _getFloatProofBBox(el, settings);
		const _propsToCheck = ["paddingTop", "paddingLeft", "paddingBottom", "paddingRight", "borderBottomWidth", "borderTopWidth", "borderLeftWidth", "borderRightWidth"];
		const st = window.getComputedStyle(el);
		const padObjVals = {};
		_propsToCheck.forEach(prop => {
			let val = parseFloat(st[prop]);
			if (isNaN(val)) {
				console.error("A NaN value for ", prop, ":", st[prop]); // I'm not sure in what cases it'd be, since it's always supposed to resolve to a numeric value, but we should check
				debugger;
				val = 0;
			}
			padObjVals[prop] = val;
		});
		// ifSkipBotPadding = true for overflow:hidden situations -- bottom padding of a parent is ignored
		// NOTE: apparently it's the same for paddingTop...
		if (ifSkipBotPadding) {
			padObjVals.paddingBottom = 0;
			padObjVals.paddingTop = 0;
		}

		bRect.top += padObjVals.paddingTop + padObjVals.borderTopWidth;
		bRect.bottom -= padObjVals.paddingBottom + padObjVals.borderBottomWidth;
		bRect.left += padObjVals.paddingLeft + padObjVals.borderLeftWidth;
		bRect.right -= padObjVals.paddingRight + padObjVals.borderRightWidth;
		bRect.x = bRect.left;
		bRect.y = bRect.top;
		bRect.width = bRect.right - bRect.left;
		bRect.height = bRect.bottom - bRect.top;
		return bRect;
	};

	function __clipBBoxToParent(_bbox, pbbox, ifEnforceParentBox = false, settings = {cropX: true, cropY: true}) {
		//NOTE: added cropX/Y to account for overflowX/Y -- turns out this can be a big deal
		const bbox = __cpyBBox(_bbox);
		if(settings.cropY){
			bbox.top = Math.max(bbox.top, pbbox.top);
			bbox.bottom = Math.min(bbox.bottom, pbbox.bottom);	
		}
		if(settings.cropX){
			bbox.left = Math.max(bbox.left, pbbox.left);
			bbox.right = Math.min(bbox.right, pbbox.right);	
		}
		// extra adjustments -- when there is a complete mismatch in bboxes <-- we'll keep top/left; hopefully being zero-sized should solve all issues (e.g., being off screen)
		bbox.right = Math.max(bbox.right, bbox.left);
		bbox.bottom = Math.max(bbox.bottom, bbox.top);
		// re-calc sizes
		bbox.width = bbox.right - bbox.left;
		bbox.height = bbox.bottom - bbox.top;
		bbox.x = bbox.left;
		bbox.y = bbox.top;
		if (!ifEnforceParentBox && (bbox.height < 0 || bbox.width < 0)) {
			console.error("BBox has a negative height/width --> returning original: ", JSON.stringify(_bbox), "Parent:", JSON.stringify(pbbox), window.location.href);
			return _bbox;
		}
		return bbox;
	}

	function __adjustBBoxForScrolling(_bbox) {
		const bbox = __cpyBBox(_bbox);
		bbox.left += window.scrollX;
		bbox.right += window.scrollX;
		bbox.top += window.scrollY;
		bbox.bottom += window.scrollY;
		bbox.x = bbox.left;
		bbox.y = bbox.top;
		return bbox;
	}
	
	function __ifCropIt(pSt, pEl, dim = "overflowX"){
		// special treatment for html/body because they are the ones scrolled anyways
		return (pEl.isSameNode(document.documentElement) || pEl.isSameNode(document.body))?["auto", "visible", "scroll"].every(val=>val !== pSt[dim]):pSt[dim] !== "visible";
	}
	
	function _getAbsBoundingRectAdjForParentOverflow(el, ifEnforceParentBox = true, ifForceRefresh = false, boxType = "normal", extraSettings = {logClippingParents: false}) {
		// NOTE: ifForceRefresh isn't used now, but we can use it later if we save the final bbox within the element -- for a speed up
		const ifSkipBotPadding = true;
		// console.assert(boxType === "normal" || boxType === "inner" || boxType === "outer", "Unknown bbox type requested: ", boxType, "Suppoted vals are normal, inner and outer", window.location.href);
		var bbox;
		switch (boxType) {
			case "normal":
				bbox = el.getBoundingClientRect();
				break;
			case "inner":
				bbox = _getInnerBBox(el);
				break;
			case "outer":
				bbox = _getOuterBBox(el);
				break;
			default:
				throw new Error("Unknown bbox type requested: " + boxType + " Suppoted vals are normal, inner and outer " + window.location.href);
		}
		// 1 - Look through ancestors up until parentElement === null <-- we've reached html
		var pEl = el.parentElement;
		var elPosCSS = window.getComputedStyle(el).position;
		var pSt; // = window.getComputedStyle(pEl);
		var containerType = "static"; // What a parent needs to be to qualify as an overflow-hiding container
		while (pEl !== null) {
			pSt = window.getComputedStyle(pEl);
			//  && elPosCSS !== "absolute" && elPosCSS !== "fixed" //absolute/fixed position makes elements ignore parents overflow <-- unless a parent is also absolute
			// 2 - If an ancestor has overflow:hidden (in some direction) or contain isn't 'none', check if some of children area is hidden <-- we don't care for other conditions for overflow:hidden to apply (e.g., parent size needs to be set and display shouldn't be table/contains) -- just compare bBoxes and clip if needed
			if (elPosCSS === "absolute" || elPosCSS === "fixed") {
				containerType = elPosCSS;
			}
			// contnrProps.needsAbs cancellation policies
			// NOTE: absolute/fixed children do not expand their parents, but are still affected by parents' container if the parents are also absolute/fixed
			if(["transform", "perspective", "filter"].some(prop=>pSt[prop] !== "none")){
				// cancels needAbs requirement for both Absolute and Fixed
				containerType = "static";
			}else if(containerType === "absolute" && (pSt.position === "relative" || pSt.position === "sticky")){
				// relative/sticky only cancels needAbs requirement to parent for "Absolute" - static els are now containers too
				containerType = "static";
			}
			const cropBoth = pSt.contain !== "none" || pEl.tagName.toLowerCase() === "marquee"; // adding marquee - it's a weird exception that always says visible
			// const cropX = pSt.overflowX !== "visible" || cropBoth;
			// const cropY = pSt.overflowY !== "visible" || cropBoth;
			const cropX = __ifCropIt(pSt, pEl, "overflowX") || cropBoth;
			const cropY = __ifCropIt(pSt, pEl, "overflowY") || cropBoth;
			if (cropX || cropY) { 
				// parent has the potential to hide overflow
				const _cssDispForOverfl = ["contents", "table", "inline-table", "inline"]; // these parent's display values result in shown overflow, so do nothing if found // NOTE: I forgot to switch off "flex" on the parent in the MDN example I experimented on for this list
				if (!_cssDispForOverfl.includes(pSt.display)) {
					if (containerType === "absolute") {
						// we only clip if a parent is also absolute - otherwise it has no effect on children
						if (["absolute", "fixed", "sticky", "relative"].includes(pSt.position)) {
							const clippedBbox = __clipBBoxToParent(bbox, _getInnerBBox(pEl, ifSkipBotPadding), ifEnforceParentBox, {cropX: cropX, cropY: cropY});
							if(extraSettings.logClippingParents && (clippedBbox.height * clippedBbox.width) < (bbox.width * bbox.height)){
								console.log("[BBOX ADJUSTING] Clipping parent: ",  pEl.outerHTML.replace(pEl.innerHTML, ""));
							}
							bbox = clippedBbox;
						}
					} else if(containerType === "fixed"){
						// we don't clip at all - fixed elements are unique this way
					} else{
						// always clip
						const clippedBbox = __clipBBoxToParent(bbox, _getInnerBBox(pEl, ifSkipBotPadding), ifEnforceParentBox, {cropX: cropX, cropY: cropY});
						if(extraSettings.logClippingParents && (clippedBbox.height * clippedBbox.width) < (bbox.width * bbox.height)){
							console.log("[BBOX ADJUSTING] Clipping parent: ",  pEl.outerHTML.replace(pEl.innerHTML, ""));
						}
						bbox = clippedBbox;
					}
				}
			}
			// 4 - repeat for the next ancestor
			elPosCSS = window.getComputedStyle(pEl).position;
			pEl = pEl.parentElement;
		}
		// 5 - check for bbox being inside the window
		const wBbox = {
			top: 0,
			left: 0,
			bottom: window.getScrlEl().scrollHeight,
			right: window.__getSaneDocScrollWidth()
			// right: window.getScrlEl().scrollWidth
		};
		// 5.1 - Extra bit for "fixed" -- clipping relative to viewport
		if(containerType === "fixed"){
			wBbox.bottom = window.innerHeight;
			wBbox.right = window.innerWidth;
		}
		// 5.2 - For iframes -- clip bbox to the actually visible part in the parent document
		if (window.getScrlEl()._thisFrameHeight !== undefined) {
			Object.assign(wBbox, {
				bottom: window.getScrlEl()._thisFrameHeight,
				right: window.getScrlEl()._thisFrameWidth
			});
		}
		bbox = __clipBBoxToParent(bbox, wBbox, ifEnforceParentBox);
		// 6 - account for window scrolling NOTE: We shouldn't scroll, so bboxes are comparable
		if(window.scrollY !== 0){
			console.warn("We shouldn't scroll -- bboxes taken at different times may not be comparable (The code often relies on the native bbox, which isn't adjusted)", location.href);	
		}
		return __adjustBBoxForScrolling(bbox);
	};
	
	function _isItOutsideTopViewport(el){
		if(window.scrollY){
			window.scrollTo({top: 0, left: 0, behavior: "instant"});
		}
		const b = el.getBoundingClientRect();
		return b.bottom <= 0 || b.right <= 0 || b.top >= window.innerHeight || b.left >= window.innerWidth;
	}

	// function _getAbsBoundingRectAdjForParentOverflow(el, ifEnforceParentBox = true, ifForceRefresh = false, boxType = "normal") {
	// 	// NOTE: ifForceRefresh isn't used now, but we can use it later if we save the final bbox within the element -- for a speed up
	// 	const ifSkipBotPadding = true;
	// 	// console.assert(boxType === "normal" || boxType === "inner" || boxType === "outer", "Unknown bbox type requested: ", boxType, "Suppoted vals are normal, inner and outer", window.location.href);
	// 	var bbox;
	// 	switch (boxType) {
	// 		case "normal":
	// 			bbox = el.getBoundingClientRect();
	// 			break;
	// 		case "inner":
	// 			bbox = _getInnerBBox(el);
	// 			break;
	// 		case "outer":
	// 			bbox = _getOuterBBox(el);
	// 			break;
	// 		default:
	// 			throw new Error("Unknown bbox type requested: " + boxType + " Suppoted vals are normal, inner and outer " + window.location.href);
	// 	}
	// 	// 1 - Look through ancestors up until parentElement === null <-- we've reached html
	// 	var pEl = el.parentElement;
	// 	var elPosCSS = window.getComputedStyle(el).position;
	// 	var pSt; // = window.getComputedStyle(pEl);
	// 	var needsAbs = false;
	// 	while (pEl !== null) {
	// 		pSt = window.getComputedStyle(pEl);
	// 		//  && elPosCSS !== "absolute" && elPosCSS !== "fixed" //absolute/fixed position makes elements ignore parents overflow <-- unless a parent is also absolute
	// 		// 2 - If an ancestor has overflow:hidden (in some direction) or contain isn't 'none', check if some of children area is hidden <-- we don't care for other conditions for overflow:hidden to apply (e.g., parent size needs to be set and display shouldn't be table/contains) -- just compare bBoxes and clip if needed
	// 		if (elPosCSS === "absolute" || elPosCSS === "fixed") {
	// 			needsAbs = true;
	// 		}
	// 		if(needsAbs && pSt.position === "relative"){
	// 			needsAbs = false; // somehow having a "relative" element in-between cancels the needs for being absolute for overflow croppings - who knew!?...
	// 		}
	// 		// NOTE: absolute/fixed children do not expand their parents, but are still affected by parents' container if the parents are also absolute/fixed
	// 		const cropBoth = pSt.contain !== "none" || pEl.tagName.toLowerCase() === "marquee"; // adding marquee - it's a weird exception that always says visible
	// 		// const cropX = pSt.overflowX !== "visible" || cropBoth;
	// 		// const cropY = pSt.overflowY !== "visible" || cropBoth;
	// 		const cropX = __ifCropIt(pSt, pEl, "overflowX") || cropBoth;
	// 		const cropY = __ifCropIt(pSt, pEl, "overflowY") || cropBoth;
	// 		if (cropX || cropY) { 
	// 			// parent has the potential to hide overflow
	// 			const _cssDispForOverfl = ["contents", "table", "inline-table", "inline"]; // these parent's display values result in shown overflow, so do nothing if found // NOTE: I forgot to switch off "flex" on the parent in the MDN example I experimented on for this list
	// 			if (!_cssDispForOverfl.includes(pSt.display)) {
	// 				if (needsAbs) {
	// 					// we only clip if a parent is also absolute - otherwise it has no effect on children
	// 					if (["absolute", "fixed", "sticky", "relative"].includes(pSt.position)) {
	// 						// 3 - Check if an element is partially outside body boundaries and adjust the initial bbox
	// 						// 3.1 - Adjust parent's bounding box for padding and border
	// 						// 3.2 - Clip target el bbox
	// 						bbox = __clipBBoxToParent(bbox, _getInnerBBox(pEl, ifSkipBotPadding), ifEnforceParentBox, {cropX: cropX, cropY: cropY});
	// 					}
	// 				} else {
	// 					// 3 - Check if an element is partially outside body boundaries and adjust the initial bbox
	// 					// 3.1 - Adjust parent's bounding box for padding and border
	// 					// 3.2 - Clip target el bbox
	// 					bbox = __clipBBoxToParent(bbox, _getInnerBBox(pEl, ifSkipBotPadding), ifEnforceParentBox, {cropX: cropX, cropY: cropY});
	// 				}
	// 			}
	// 		}
	// 		// 4 - repeat for the next ancestor
	// 		elPosCSS = window.getComputedStyle(pEl).position;
	// 		pEl = pEl.parentElement;
	// 	}
	// 	// 5 - check for bbox being inside the window
	// 	const wBbox = {
	// 		top: 0,
	// 		left: 0,
	// 		bottom: window.getScrlEl().scrollHeight,
	// 		right: window.__getSaneDocScrollWidth()
	// 		// right: window.getScrlEl().scrollWidth
	// 	};
	// 	// 5.1 - For iframes -- clip bbox to the actually visible part in the parent document
	// 	if (window.getScrlEl()._thisFrameHeight !== undefined) {
	// 		Object.assign(wBbox, {
	// 			bottom: window.getScrlEl()._thisFrameHeight,
	// 			right: window.getScrlEl()._thisFrameWidth
	// 		});
	// 	}
	// 	bbox = __clipBBoxToParent(bbox, wBbox, ifEnforceParentBox);
	// 	// 6 - account for window scrolling
	// 	return __adjustBBoxForScrolling(bbox);
	// };

	// window._filterOutNestedElements_OLD = function (elArr) {
	// 	return elArr.filter(function (currEl, i, arr) {
	// 		const __origEl = currEl;
	// 		while (currEl = currEl.parentElement) {
	// 			if(arr.includes(currEl)){
	// 				let otherEl = arr.find(x=> x === currEl);
	// 				console.error("We have a match while looking for nested elements to not save as images twice!", __origEl.tagName + __origEl.className, " VS ", otherEl.tagName + otherEl.className);
	// 				return false;				
	// 			}
	// 		}
	// 		return true;
	// 	});
	// };

	function _filterOutNestedElements(elArr) {
		// this F 'flattens' the hierarchy in the elArr, so descendants of an el in elArr are filtered out from elArr
		if (elArr.toArray !== undefined) {
			elArr = elArr.toArray(); // from JQ to Array
		}
		const nonNestArr = elArr.filter((el, i, arr) => {
			// if some other element in elArr has 'el' as a descendant, filter it out
			return !arr.some((anotherEl) => { // looking for the 1st el that contains our original 'el'
				if (anotherEl === el) {
					return false; // because node.contains also returns 'true' for the node itself
				}
				return anotherEl.contains(el);
			});
		});
		return [... new Set(nonNestArr)]; // filter out duplicates
	};

	function _filterOutAncestorElements(elArr) {
		// similar to _filterOutNestedElements, but filters out elements higher in the hierarchy, i.e., filters out ancestors
		if (elArr.toArray !== undefined) {
			elArr = elArr.toArray(); // from JQ to Array
		}
		return elArr.filter((el, i, arr) => {
			return arr.every((anotherEl) => {
				return el.isSameNode(anotherEl) || !el.contains(anotherEl);
			});
		});
	}

	const _regNoInvisButWithWhiteSpace = /[\f\n\r\t\v​\u00a0\u1680​\u180e\u2000​\u200a​\u2028\u2029\u202f\u205f​\u3000\ufeff]/gi;
	function __getTextNoCleaning(el) {
		// NOTE: This F only gets immediate-child texts, not full texts
		var textContent = "";
		if (el.nodeType === 3) {
			textContent = el.textContent.trim();
		} else if (el.childNodes.length === 0 && el.value !== undefined) {
			// this a control element, not text per-se
			textContent = el.value || el.placeholder || "";
			// fool check
			console.assert(["input", "option", "button", "textarea"].includes(el.tagName.toLowerCase()), "Unknown control/element with a 'value' property: ", el.tagName, window.location.href);
		} else {
			for (var i = el.childNodes.length; i--;) {
				const subEl = el.childNodes[i];
				if (subEl.nodeType === 3) {
					textContent += subEl.textContent.trim();
				}
			}
		}
		return textContent; //.replace(_regNoInvisButWithWhiteSpace, '');
	};

	function _getFullTextCleanAllButSpaces(el) { // Use this to get texts to analyze/save/sample
		return _cutInvisCharExceptSpaces(window.__getTextNoCleaning(el));
		// return window.__getTextNoCleaning(el).replace(_regNoInvisButWithWhiteSpace, '');
	};

	function _cutInvisCharExceptSpaces(str) {
		return str.replace(_regNoInvisButWithWhiteSpace, '');
	}

	function _urlToHost(url) {
		return url.split("://")[1].split("/")[0];
	};

	window._getZIndexAsArr = function(el, searchUntilEl = document.documentElement) {
		const z = [];
		while (el !== searchUntilEl) {
			try {
				var st = window.getComputedStyle(el);
			} catch (err) {
				throw new Error(err);
			}
			let elZ = parseInt(st.zIndex);
			if (st.position !== "static") { // static position results in zIndex being ignored; otherwise, we need to record it, even if it's zero - elements are rendered in their new contexts
				elZ = isNaN(elZ) ? 0 : elZ;
				z.unshift(elZ);
			}
			el = el.parentElement;
		}
		if (!z.length) {
			z.unshift(0); //when no zIndexes were found, we are in the default rendering context of documentElement/searchUntilEl
		}
		return z;
	};

	function __getAncestorsInArr(el) {
		const res = [];
		res.unshift(el);
		while (el.parentElement !== null) {
			res.unshift(el.parentElement);
			el = el.parentElement;
		};
		return res;
	}

	function __makeCleanSpan() {
		const span = document.createElement("span");
		// NOTE: we need to ensure out all.css has a "__clean-span" class
		span.classList.add("__clean-span"); // ensuring pseudo elements aren't set for our clean span -- only possible with CSS, and I don't feel like implementing a clean-up for our cssInjector here --> hence relying on a class defined in "all.css" coming with out addon
		// TODO: Should we move all of the CSS props below to all.css?... Instead of setting them manually?
		["padding-top", "padding-bottom", "padding-left", "padding-right", "margin-left", "margin-right", "margin-top", "margin-bottom", "border-bottom-width", "border-top-width", "border-left-width", "border-right-width"].forEach((prop) => {
			span.style.setProperty(prop, "0", "important");
		});
		["box-shadow"].forEach((prop) => {
			span.style.setProperty(prop, "none", "important");
		});
		const inheritedProps = ["font-family", "font-size", "font-stretch", "font-style", "font-variant", "font-weight", "line-height", "word-spacing", "overflow-wrap", "white-space", "letter-spacing", "direction", "color", "word-spacing", "text-decoration", "text-transform", "text-shadow"];
		span.__inheritedProps = inheritedProps;
		inheritedProps.forEach((prop) => {
			span.style.setProperty(prop, "inherit", "important");
		});
		["width", "height", "position", "min-width", "min-height", "filter", "background-image", "top", "left", "bottom", "right", "opacity", "display", "float"].forEach((prop) => {
			span.style.setProperty(prop, "initial", "important");
		});
		window.__enforceManyCSSPropOnElArr([span], {"animation-play-state": "paused", "transition": "all 0s 0s"});
		return span;
	}
	
	function __makeCleanDiv(){
		const div = document.createElement("div");
		// we don't care about restoring these props -- this div is meant to be removed from DOM before HTML saving
		window.__enforceManyCSSPropOnElArr([div], {"animation-play-state": "paused", "transition": "all 0s 0s"});
		return div;
	}
	
	function __makeInvisDiv(){
		// const div = document.createElement("div");
		const div = document.createElement("plcHolder");
		div.classList.add("__invis-div");
		return div;
	}

	function _is1stElAbove2ndEl(el1, el2) {
		// 1 - Find a common ancestor
		const ancArr1 = __getAncestorsInArr(el1);
		const ancArr2 = __getAncestorsInArr(el2);
		//	var commonAnc = ancArr1.shift(); // we always have at least one element in ancArr1
		var i = 0; // we always have at least one element in ancArr1
		while (i < ancArr1.length && ancArr2.includes(ancArr1[i])) {
			i++;
		}
		// we've found the first non-shared-ancerstor i OR finished looking through the array --> step back one steps
		i--;
		const sharedAnc = ancArr1[i];
		// 2 - Get zIndex arrays for both
		const z1 = window._getZIndexAsArr(el1, sharedAnc);
		const z2 = window._getZIndexAsArr(el2, sharedAnc);
		// 3 - Compare the 1st values only - only they matter
		if (z1[0] > z2[0]) {
			return true; // el1 is ABOVE
		} else if (z1[0] < z2[0]) {
			return false; // el1 is BELOW
		}
		// Else both have the same z-index --> check for their order in HTML
		const el1ComesAfterEl2InDom = el1.compareDocumentPosition(el2) === 2; // NOTE: We may have to use a bitwise operation '& document.DOCUMENT_POSITION_PRECEDING' instead of equality
		return el1ComesAfterEl2InDom;
	};

	function _sortElArrByDocOrder(elArr) {
		// sorts elements by their order in document HTML/DOM <== Not sure how it'll handle nestedness...
		return elArr.sort((a, b) => {
			if (a.isSameNode(b)) {
				return 0;
			}
			return a.compareDocumentPosition(b) & window.document.DOCUMENT_POSITION_PRECEDING;
		});
	}

	function _do2elsOverlap(_el1, _el2) {
		window.scroll(0, 0); // because we'll be screenshotting from this position - so we want all the sticky elements to be in their default position
		const toleranceThr = 0;
		const bboxOne = _getAbsBoundingRectAdjForParentOverflow(_el1);
		const bboxTwo = _getAbsBoundingRectAdjForParentOverflow(_el2);
		return _do2bboxesOverlap(bboxOne, bboxTwo, toleranceThr);
		// const _overlapF = (el1, el2) => {
		// 	const rect1 = el1.getBoundingClientRect(); // xy correspond to the XY relative to the page - because we've just scrolled to 0,0
		// 	const rect2 = el2.getBoundingClientRect();
		// 	const points = [{
		// 		x: rect1.left,
		// 		y: rect1.top
		// 	}, {
		// 		x: rect1.left,
		// 		y: rect1.bottom
		// 	}, {
		// 		x: rect1.right,
		// 		y: rect1.top
		// 	}, {
		// 		x: rect1.right,
		// 		y: rect1.bottom
		// 	}];
		// 	return points.some((point) => {
		// 		// checking if a point is within the other element rectangle
		// 		return point.x >= rect2.left && point.x <= rect2.right && point.y >= rect2.top && point.y <= rect2.bottom;
		// 	});
		// };
		// return _overlapF(_el1, _el2) || _overlapF(_el2, _el1);
	};

	function _do2bboxesOverlap(bboxOne, bboxTwo, inToleranceThr = 0) {
		// toleranceThr -- if the overlap is less than this, count them as not overlapping
		return __do2intervalsOverlap(bboxOne, bboxTwo, "X", inToleranceThr) && __do2intervalsOverlap(bboxOne, bboxTwo, "Y", inToleranceThr);
		// NOTE: Checking corners misses out on situations when 1 bbox is long and thin, and the other is short and thick -- none of the corners are contained, but bboxes overlap ==> switching to checking interval overlap instead
		// const _overlapF = (rect1, rect2) => {
		// 	const points = [{
		// 		x: rect1.left,
		// 		y: rect1.top
		// 	}, {
		// 		x: rect1.left,
		// 		y: rect1.bottom
		// 	}, {
		// 		x: rect1.right,
		// 		y: rect1.top
		// 	}, {
		// 		x: rect1.right,
		// 		y: rect1.bottom
		// 	}];
		// 	return points.some((point) => {
		// 		// checking if a point is within the other element rectangle
		// 		return point.x >= (rect2.left + toleranceThr) && point.x <= (rect2.right - toleranceThr) && point.y >= (rect2.top + toleranceThr) && point.y <= (rect2.bottom - toleranceThr);
		// 	});
		// };
		// return _overlapF(bboxOne, bboxTwo) || _overlapF(bboxTwo, bboxOne);
	}

	function __do2intervalsOverlap(interv1, interv2, direction = "X", inToleranceThr = 0) {
		console.assert(direction === "X" || direction === "Y", "Only X and Y are acceptable directions for intervalOverlap inspection.", window.location.href);
		const props = (direction === "X") ? ["left", "right"] : ["top", "bottom"];
		const overlap = Math.min(interv1[props[1]], interv2[props[1]]) - Math.max(interv1[props[0]], interv2[props[0]]);
		return overlap > inToleranceThr;
		// NOTE: the code below (checking if a point is within an interval) only works for toleranceThr === 0	
		// function __pointWithinInterv(pCoord, interval, props){
		// 	return pCoord >= (interval[props[0]] + toleranceThr) && pCoord <= (interval[props[1]] - toleranceThr);
		// };
		// return __pointWithinInterv(interv1[props[0]], interv2, props) || __pointWithinInterv(interv2[props[0]], interv1, props);
	}

	function __objArr2TabTable(anArr) {
		// console.log("fullFName: ", fullFName);
		try {
			var head = Object.keys(anArr[0]);
		} catch (e) {
			console.log("We can't have a heading for an empty array of results: ", anArr, " returning an empty string to save");
			return "";
		}
		const legend = head.join("\t") + "\n";
		var strToSave = "";
		for (var i = anArr.length; i--;) {
			// var aLine = "";
			var thisObj = anArr[i];
			var subArr = [];
			for (var ihead = 0, iheadLength = head.length; ihead < iheadLength; ihead++) {
				subArr[ihead] = thisObj[head[ihead]];
			}
			strToSave += subArr.join("\t") + "\n";
		}
		return legend + strToSave;
	};


	function __setTxtRecurs(anEl, newTxtVal) {
		// Intended to be used to detect if an element contains a single line of text
		// F replaces all non-empty textNode values
		// console.assert(anEl.nodeType === 1, "Only actual htmlElements are allowed -- no textNodes etc., ", anEl, "This el nodeType:", anEl.nodeType);
		anEl.childNodes.forEach(childEl => {
			if (childEl.nodeType === 3) {
				childEl._beenChanged = true;
				if (window.cleanString(childEl.nodeValue).length) {
					childEl._oldText = childEl.nodeValue; // keep it for a fool check later
					childEl.nodeValue = newTxtVal;
				} // else it might be a decorative -- to increase white margins
			} else if(childEl.nodeType === document.ELEMENT_NODE){ // so we don't do it for comments etc.
				__setTxtRecurs(childEl, newTxtVal);
			}
		});
	}

	function __restoreTxtRecurs(anEl) {
		console.assert(anEl.nodeType === 1, "Only actual htmlElements are allowed -- no textNodes etc., ", anEl);
		anEl.childNodes.forEach(childEl => {
			if (childEl.nodeType === 3) {
				console.assert(childEl._beenChanged, "AFTUNG: Trying to restore non-changed text -- smth is terribly wrong, initEl", anEl, "ChildEl:", childEl, window.location.href);
				childEl._beenChanged = false;
				if (childEl._oldText !== undefined) {
					childEl.nodeValue = childEl._oldText;
				}
			} else if(childEl.nodeType === document.ELEMENT_NODE){
				__restoreTxtRecurs(childEl);
			}
		});
	}

	function isStringAColor(strColor) {
		const s = new Option().style;
		s.color = strColor;
		return s.color !== '';
	}

	function __el2stringForDiagnostics(el) {
		const pTag = (el.parentNode)?(el.parentNode.tagName?el.parentNode.tagName.toLowerCase():"HTML"):"DETACHED element";
		// return [el.tagName.toLowerCase(), "." + Array.from(el.classList).join("."), "#" + el.id, "parent:", pTag ].join(" ") + ", " + window.location.href;
		const stAttr = el.getAttribute("style");
		return [el.outerHTML.replace(el.innerHTML, "").replace(stAttr, "[replcd]"), "parent:", pTag, window.location.href].join(" ");
	}

	function hostname2baseHostname(hostnameStr, settings = {pollEmptyHost: false}) {
		// extracts the "basic" hostname for a domain <-- we mainly use it to check if an <a> is external or not
		// service urls, like about:blank have an empty hostname -- use the most common href instead
		if(settings.pollEmptyHost && (!hostnameStr || !hostnameStr.length)){
			// find all links
			const allHosts = Array.from(document.querySelectorAll("a")).map(x=>x.hostname).filter(x=>x);
			// count occurances
			const countObj = {};
			allHosts.forEach(h => {
				if(countObj[h] === undefined){
					countObj[h] = 0;
				}
				countObj[h]++;
			});
			// take most common hostname
			if(allHosts.length){
				hostnameStr = Object.entries(countObj).sort((a, b)=>b[1]-a[1])[0][0];
			}
		}
		// handling empty cases
		if(!hostnameStr || !hostnameStr.length){
			console.warn("Empty hostname -- we can't extract baseHostname from it: ", hostnameStr, location.href);
			return "";
		}
		const hostParts = hostnameStr.split(".");
		if (hostParts.length > 2 && hostParts[hostParts.length - 2].length <= 3) {
			// cases of popular 2nd level domains, like gov.uk or co.uk
			return hostParts.slice(-3).join(".");
		}
		return hostParts.slice(-2).join(".");
	}

	function _sampleFromArr(arr, n) {
		n = Math.round(n);
		console.assert(n > 0 && n < arr.length, "Can't sample ", n, " elements from arr of length", arr.length, window.location.href);
		return (new Array(n)).fill().map((el, i) => [i, Math.random()]).sort((a, b) => a[1] - b[1]).slice(0, n).map(x => arr[x[0]]);
	}

	function getFullPageBBox() {
		const sizeObj = {
			x: 0,
			y: 0,
			top: 0,
			left: 0
		};
		let zoomedSizeLimit = window.MAX_SCREENSHOT_LENGTH;// Math.floor(window.MAX_SCREENSHOT_LENGTH / window.devicePixelRatio); // NOTE: devicePixelRatio messes up when we have a mismatch between virtual and physical pixels
		sizeObj.width = sizeObj.right = Math.min(window.__getSaneDocScrollWidth(), zoomedSizeLimit);
		// sizeObj.width = sizeObj.right = Math.min(window.getScrlEl().scrollWidth, zoomedSizeLimit);
		sizeObj.height = sizeObj.bottom = Math.min(window.getScrlEl().scrollHeight, zoomedSizeLimit);
		return sizeObj;
	}

	function __setCSSPropJqArr(jqObj, prop, val, imp = "", _changeId = undefined) { // val can be a function or string
		const arr = (typeof jqObj.toArray === 'function') ? jqObj.toArray() : jqObj;
		const changeId = _changeId || "ch" + Math.round(Math.random() * 10000000);
		console.assert(!imp || imp === "important");
		arr.forEach((el) => {
			if(el["_oldVals"] === undefined){
				el["_oldVals"] = {};
				// el["_oldImps"] = {};
			}
			if(el["_oldVals"][prop] === undefined){
				el["_oldVals"][prop] = {};
			}
			console.assert(el["_oldVals"][prop][changeId] === undefined); // we forgot to clean it or we have a duplicate id?
			el["_oldVals"][prop][changeId] = {val: el.style.getPropertyValue(prop), imp: el.style.getPropertyPriority(prop)};
			// // not over-writing the original values if exist
			// if (el["_oldVal_" + prop] === undefined) {
			// 	el["_oldVal_" + prop] = el.style.getPropertyValue(prop);
			// }
			// if (el["_oldImp_" + prop] === undefined) {
			// 	el["_oldImp_" + prop] = el.style.getPropertyPriority(prop);
			// }
			// el.style[prop] = ((typeof val === 'function') ? val(el) : val) + imp;
			el.style.setProperty(prop, (typeof val === 'function') ? val(el) : val, imp);
			el["_latestChangeCssId"] = changeId;
		});
		return changeId;
	}

	function __restoreCSSPropJqArr(jqObj, prop, _changeId = undefined) { // If an original-page element has been modified by us, and we want to restore it back to original
		const arr = (typeof jqObj.toArray === 'function') ? jqObj.toArray() : jqObj;
		arr.forEach((el) => {
			const changeId = _changeId || el["_latestChangeCssId"];
			if(el["_oldVals"] === undefined || el["_oldVals"][prop] === undefined || el["_oldVals"][prop][changeId] === undefined){
				debugger;
				return console.log("%c[__restoreCSSPropJqArr] Trying to restore a piece of CSS that wasn't set, prop: " + prop + " changeId: " + changeId + window.__el2stringForDiagnostics(el), "color:red;");
			}
			el.style.setProperty(prop, el["_oldVals"][prop][changeId].val, el["_oldVals"][prop][changeId].imp);
			// el.style[prop] = el["_oldVals"][prop][changeId];
			delete el["_oldVals"][prop][changeId];
			// let oldVal = el["_oldVal_" + prop] || "";
			// let oldImp = el["_oldImp_" + prop] || "";
			// el.style.setProperty(prop, oldVal, oldImp);
			// // internal clean-up -- fewer things to see during debug
			// delete el["_oldVal_" + prop];
			// delete el["_oldImp_" + prop];
		});
	}

	function __enforceManyCSSPropOnElArr(elArr, cssPropObj, _changeId = undefined) {
		//cssPropObj can be created with window.__cssValsToObj from scramble.js
		const changeId = _changeId || "ch" + Math.round(Math.random() * 10000000); // so we keep a reference to the old styles
		Object.keys(cssPropObj).forEach((k, i) => {
			__setCSSPropJqArr(elArr, k, cssPropObj[k], "important", changeId);
		});
		return changeId;
	}

	function __restoreManyCSSPropOnElArr(elArr, cssPropArr, changeId) {
		cssPropArr.forEach(prop => __restoreCSSPropJqArr(elArr, prop, changeId));
	}

	function _cmpBBoxes(b1, b2, thr = 5) {
		console.assert(thr > 0 || thr === 0, "We shouldn't use negative thresholds for bbox comparison - it'll always say they don't coincide", thr);
		return Math.abs(b1.left - b2.left) <= thr && Math.abs(b1.top - b2.top) <= thr && Math.abs(b1.bottom - b2.bottom) <= thr && Math.abs(b1.right - b2.right) <= thr;
	}

	function _getFloatProofBBox(el, settings = {enforceHeight2Content: false}) {
		// some bboxes are 0 sized because their elements are in their own block formatting contexts -- check for that and try to fix with flow-root
		// NOTE: this f is mainly to be used in semantic group detection -- only then sizes matter for the root elements
		var bbox = __cpyBBox(el.getBoundingClientRect());
		if (bbox.height === 0 || settings.enforceHeight2Content) {
			const st = window.getComputedStyle(el);
			// NOTE: if flow-root solution doesn't work, we can try with overflow:hidden -- should have the same effect on floats
			if (st["display"] !== "none") {
				const _cssChId = window.__setCSSPropJqArr([el], "display", "flow-root", "important");
				const tmpBbox = el.getBoundingClientRect();
				bbox.height = tmpBbox.height;
				bbox.bottom = tmpBbox.bottom;
				bbox.top = tmpBbox.top; // because inline bboxes kinda stay in the middle of their content
				// bbox = __cpyBBox(el.getBoundingClientRect());
				// if (bbox.height > 0) {
				// 	console.warn("Found element enlarged by flow-root --> check it out", window.__el2stringForDiagnostics(el));
				// }
				window.__restoreCSSPropJqArr([el], "display", _cssChId);
			}
		}
		return bbox;
	}
	
	const _getTextNodeBBox = (()=>{
		const range = document.createRange();
		return (txtNode)=>{
			console.assert(txtNode.nodeType === document.TEXT_NODE, "getTextNodeBBox only accepts text nodes, nodeType:", txtNode.nodeType);
			range.selectNode(txtNode);
			return range.getBoundingClientRect();
		};
	})();
	
	class CssInjector{
		constructor(){
			// for cases when I can't use elements' style, e.g., for pseudoElements
			this.styleEl = document.createElement("style");
			this.sheet = document.head.appendChild(this.styleEl).sheet;
		}
		static defaultSheet;
		static _injectStringCss(selectorStr, cssStr){
			if(!CssInjector.defaultSheet){
				CssInjector.defaultSheet = document.head.appendChild(document.createElement("style")).sheet;
			}
			CssInjector.defaultSheet.insertRule(`${selectorStr}{${cssStr}}`);
		}
		// _injectCss (selector, cssObj) {
		// 	const propText = Object.entries(cssObj).map(kv => kv.join(":")).join(";");
		// 	// const propText = Object.keys(cssObj).map(function (p) {
		// 	//     return p + ":" + (p === "content" ? "'" + cssObj[p] + "'" : cssObj[p]);
		// 	// }).join(";");
		// 	this.sheet.insertRule(selector + "{" + propText + "}", this.sheet.cssRules.length);
		// }
		_injectCss1Element(el, pseudo = "", cssObj){
			const propText = Object.entries(cssObj).map(kv => kv.join(":")).join(";");
			const ifNativeIdSet = new Boolean(el.id);
			if(!el.id){
				el.id = window._generateId();
			}
			var selector = "#" + el.id + pseudo;
			// checking for duplicate ids -- yes, it happens
			if(ifNativeIdSet && document.querySelectorAll("#" + CSS.escape(el.id)).length > 1){
				const uIdSel = window._generateId();
				const uIdVal = window._generateId();
				el.dataset[uIdSel] = uIdVal;
				selector = `[data-${uIdSel}='${uIdVal}']${pseudo}`;
				console.log("[CSS INJECT]%c Duplicate native id found --> switching to attibutes as selectors, new selector: " + selector + ", id: " + el.id + " Loc:" + window.location, "color:red;font-weight:bolder;");
			}
			try {
				this.sheet.insertRule(selector + "{" + propText + "}", this.sheet.cssRules.length);
			} catch (e) {
				// probably an id is faulty
				console.warn(e, "Couldn't assign css for an element", window.__el2stringForDiagnostics(el));
				const aClass = window._generateId();
				el.classList.add(aClass);
				const classSel = "." + aClass + pseudo;
				this.sheet.insertRule(classSel + "{" + propText + "}", this.sheet.cssRules.length);
			}
		}
		_injectStringCss(selectorStr, cssStr){
			this.sheet.insertRule(`${selectorStr}{${cssStr}}`);
		}
		_removeAllCss () {
			this.styleEl.remove();
		}
		// // NOTE: I'm not implementing one-by-one removal of added rules -- I don't see a use for it now
	}
	
	function __getSaneDocScrollWidth(){
		// F for cases of giant X overflow being hidden
		const cw = window.getScrlEl().clientWidth;
		const sw = window.getScrlEl().scrollWidth;
		return sw < cw * 1.5? sw: cw;
	}

	window.__setCSSPropJqArr = __setCSSPropJqArr;
	window.__restoreCSSPropJqArr = __restoreCSSPropJqArr;
	window.__enforceManyCSSPropOnElArr = __enforceManyCSSPropOnElArr;
	window.__restoreManyCSSPropOnElArr = __restoreManyCSSPropOnElArr;

	window._cmpBBoxes = _cmpBBoxes;
	window._getInnerBBox = _getInnerBBox;
	window._getOuterBBox = _getOuterBBox;
	window._getFloatProofBBox = _getFloatProofBBox;
	window._getTextNodeBBox = _getTextNodeBBox;
	window.__makeCleanSpan = __makeCleanSpan;
	window.__makeCleanDiv = __makeCleanDiv;
	window.__makeInvisDiv = __makeInvisDiv;
	window.__setTxtRecurs = __setTxtRecurs;
	window.__restoreTxtRecurs = __restoreTxtRecurs;
	window._getAbsBoundingRectAdjForParentOverflow = _getAbsBoundingRectAdjForParentOverflow;
	window._isStringAColor = isStringAColor;
	window.__cpyBBox = __cpyBBox;
	window.rgbToLab = rgbToLab;
	window._do2elsOverlap = _do2elsOverlap;
	window._do2bboxesOverlap = _do2bboxesOverlap;
	window.__objArr2TabTable = __objArr2TabTable;
	window.__el2stringForDiagnostics = __el2stringForDiagnostics;
	window._cutInvisCharExceptSpaces = _cutInvisCharExceptSpaces;
	window.hostname2baseHostname = hostname2baseHostname;

	window._filterOutNestedElements = _filterOutNestedElements;
	window._filterOutAncestorElements = _filterOutAncestorElements;

	window._sortElArrByDocOrder = _sortElArrByDocOrder;
	window._is1stElAbove2ndEl = _is1stElAbove2ndEl;
	window._sampleFromArr = _sampleFromArr;
	window.getFullPageBBox = getFullPageBBox;
	window.__do2intervalsOverlap = __do2intervalsOverlap;
	window._urlToHost = _urlToHost;
	
	window._getFullTextCleanAllButSpaces = _getFullTextCleanAllButSpaces;
	window.__getTextNoCleaning = __getTextNoCleaning;

	// window._getAbsBoundingRect = _getAbsBoundingRect; // DO I even use it?..

	window.CssInjector = CssInjector;
	window._urlFromCssStr = _urlFromCssStr;
	
	window.__getSaneDocScrollWidth = __getSaneDocScrollWidth;
	window._isItOutsideTopViewport = _isItOutsideTopViewport;
	

})();

undefined;
