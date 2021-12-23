// hide the insides of the el AND visible overlays that aren't el or its ancestors

const allJqToSubHide = $(aJqEl).find(":visible").add(jqOverlaysToHide).add(jqOverlaysToHide.find(":visible")); // Hide both a) the insides and b) overlapping overlays
window.__setCSSPropJqArr(allJqToSubHide, "visibility", "hidden", "important");
window.__setCSSPropJqArr(allJqToSubHide, "opacity", "0", "important");
//						allJqToSubHide.css({"opacity": "0", "visibility": "hidden"}); // NOTE: I was unable to hide element instantaneously with "visibility:hidden" - there was a delay despite me setting transition time to 0
// NOTE: we may still want to have "visibility:hidden" - mainly because Opacity doesn't work for backgrounds, so things may still be visible

const jqOverlaysToHide = _jqOverlays.filter(function () {
	return !$(aJqEl).closest(this).length;
});

	// restore visibility of internal content
	window.__restoreCSSPropJqArr(allJqToSubHide, "visibility");
	window.__restoreCSSPropJqArr(allJqToSubHide, "opacity");
	//							// restore the position of icon if needed
	//							if(_bgPos){ // disabled for the noop _getNonRepeatedBgImgSizeNoOp
	//								aJqEl.style["background-position"] = _bgPos;
	//							}




	window._bgImgToCanvas = function (el, frwdObj = {}) { // ALERT: This F doesn't work with bg positioning/clipping/scaling etc --> switch to on-screen screenshoting after removing children
		return new Promise(function (doneF, errorF) {
			const styles = window.getComputedStyle(el);
			if (window.getComputedStyle(el)["background-image"].toLowerCase().indexOf("url") !== -1) {
				// there is background
				const img = new Image();
				var timedOutFlag = true;
				img.onerror = function (err) {
					timedOutFlag = false;
					console.error("[_bgImgToCanvas] Couldn't load an image to check it's size");
					errorF("Couldn't load an image to check it's size");
				};
				img.onload = function (ev) {
					timedOutFlag = false;
					const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
					canvas.width = img.width;
					canvas.height = img.height;
					const ctx = canvas.getContext("2d");
					ctx.drawImage(img, 0, 0); //TODO: We should fill canvas with a bg color -- otherwise transparent images appear black when calc avg color
					frwdObj.cnvs = canvas;
					doneF(frwdObj);
				};
				// So we don't get stuck if one image perpetually doesn't load for some reason
				window.setTimeout(function () {
					if (timedOutFlag) {
						errorF("[_bgImgToCanvas] Timed out while trying to load an image");
					} // else all is done
				}, 5000);
				const __bgi = styles["background-image"];
				img.src = __bgi.substring(5, __bgi.length - 2);
			} else {
				// there is no background - just return as it is
				errorF("The element has no background to screenshot...", el.tagName, window.getComputedStyle(el)["background-image"]);
			}
		});
	};


// window._cmpZIndex - was based on a wrong understanding of how zIndexes worked
window._cmpZIndex = function(el1, el2){
	const z1 = window._getZIndexAsArr(el1);
	const z2 = window._getZIndexAsArr(el2);
	for(let i = 0, len = Math.min(z1.length, z2.length); i < len; i++){
		if(z1[i]>z2[i]){
			return 1; // el1 is ABOVE
		}
		if(z1[i]<z2[i]){
			return -1; // el1 is BELOW
		}
	}
	// if we are here, both elements shared ancestors up to a point
	if(z1.length > z2.length){
		if(z1[z2.length]>0){ // We are sure that z1[z2.length] !== 0 because we checked in window._getZIndexAsArr
			return 1; // el1 is ABOVE
		}
		return -1; // el1 is BELOW
	}else if(z1.length < z2.length){
		if(z2[z1.length] > 0){
			return -1; // el1 is BELOW
		}
		return 1; // el1 is ABOVE
	}
	// else it's all equal
	return 0;
};


// _checkZIndexVisibility didn't work because we only checked 5 points, which was not enough in many cases, often in iFrames
// Also this wouldn't work with transparent overlays
function _checkZIndexVisibility(el) {
	// NOTE: this F requires scrolling, but scrolling doesn't work if we have Fixed elements ==> move HTML and all fixed elements instead of scrolling
	window.scroll(0, 0);
	// hide children - content won't shift since the space is still reserved after "visibility:hidden"
	const jqChildrenToHide = $(el).find(":visible");
	__setCSSPropJqArr(jqChildrenToHide, "visibility", "hidden", "important");
	// make sticky elements static
	const jqStickies = __getStickyNodes();
	__setCSSPropJqArr(jqStickies, "position", "static", "important");
	// get BBox
	const b = el.getBoundingClientRect();
	const points = [[(b.left + b.right)/2, (b.top + b.bottom)/2], [b.left + 1, b.top + 1], [b.left + 1, b.bottom - 1], [b.right - 1, b.top + 1], [b.right - 1, b.bottom - 1]]; // we only check the 4 corners and the center
	const nodesToMove = __getViewportRelativeItemsArr();
	var res = false;
	var i = 0;
	while (!res && i < points.length) {
		var otherEl;
		if(__isPointInViewport(points[i][0], points[i][1])){
			// we don't need to scroll -- deals with fixed elements that would scroll along with viewport and not match the old coordinates
			// sticky items are also dealt with -- we've set them to static above
			otherEl = document.elementFromPoint(points[i][0], points[i][1]);
		}else{
			// elementFromPoint only works if it's inside viewport; otherwise null is returned; hence, scrolling
			__setCSSPropJqArr(nodesToMove, "top", (el)=>{
				const {y} = el.getBoundingClientRect();
				return ((y + window.scrollY) - points[i][1]).toString() + "px"; // shifting top
			}, "important");
			__setCSSPropJqArr(nodesToMove, "left", (el)=>{
				const {x} = el.getBoundingClientRect();
				return ((x + window.scrollX) - points[i][0]).toString() + "px"; // shifting top
			}, "important");
//				otherEl = document.elementFromPoint(points[i][0] - window.scrollX, points[i][1] - window.scrollY);
			otherEl = document.elementFromPoint(0, 0);
			__restoreCSSPropJqArr(nodesToMove, "top");
			__restoreCSSPropJqArr(nodesToMove, "left");
		}
		if (!otherEl) {
//				debugger;
			console.error("Outside the viewport..."); // disable later
			res = false; // Here the element is hidden due to being shifted outside the window - typical for "carousels"
		} else {
			if (otherEl === el) {
				res = true;
			} else {
				const otherStyle = window.getComputedStyle(otherEl);
				if (otherStyle["opacity"] !== "1") {
					res = true;
				}
			}
		}
		i++;
	}
	__restoreCSSPropJqArr(jqChildrenToHide, "visibility");
	__restoreCSSPropJqArr(jqStickies, "position");
//		window.scroll(0, 0);
	return res;
};

function __isPointInViewport(x, y){
	return y < document.documentElement.clientHeight && x < document.documentElement.clientWidth;
}

function __getStickyNodes(){
	return $(":visible").filter(function(){
		return window.getComputedStyle(this).position === "sticky";
	});
}

function __getViewportRelativeItemsArr(){
	const res = $(":visible").filter(function(){
		return window.getComputedStyle(this).position === "fixed";
	}).toArray();
	res.push(document.documentElement);
	return res;
}