/*eslint-env browser */
// helper, but focuses on DOM, Elements, Nodes -- a bit less low-level

(function(){
	function restoreElement(placeholderEl, realElRef){
		// replaces placeholder with the Real el and ensure old styles are enforced <-- because removing/adding Elements resets animations, and many animations start out with elements invisible
		// 0 - replace
		placeholderEl.replaceWith(realElRef);
		// 1 - list all elements to potentially restore
		if(realElRef.nodeType === document.ELEMENT_NODE){
			// only real Elements should be restored
			const els2check = [realElRef];
			if(realElRef.children.length){ // no point searching if there are no children
				const descendants = window.domGetters.getAllVis().toArray().filter(visEl=>!visEl.isSameNode(realElRef) && realElRef.contains(visEl));
				els2check.push(...descendants);
			}
			// 2 - Revert styles for el and descendants
			// FIXME: Also check for pseudoelements
			window.revert2PreCompStyles(els2check, "UIFrozen", {bruteForce: true});
		}
	}
	
	window.DOMutils = {
		restoreElement: restoreElement
	};
})();
