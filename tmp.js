// // check what's contained in what, and how many full, unique groups we have
// const _allPrims = elArrArrCpy.flat();
// const extraGrDat = mixedGroups.map((gr, i, arr) => {
// 	const res = {id: idArr[i]};
// 	res.hasRoot = !Array.isArray(gr);
// 	if(Array.isArray(gr)){
// 		res.isNestedIn = idArr.filter((id, idI)=>{
// 			const anotherGr = arr[idI];
// 			// note: arrays of elements are unique/non-overlapping -- no need to check them
// 			if(Array.isArray(anotherGr)){
// 				return false;
// 			}
// 			return gr.filter(primEl=>anotherGr.contains(primEl)).length >= gr.length*MIN_GR_OVERLAP_SAME_GROUPS;
// 		});
// 		res.containsGroups = idArr.filter((id, idI)=>{
// 			const anotherGr = arr[idI];
// 			// note: arrays of elements are unique/non-overlapping -- no need to check them
// 			if(Array.isArray(anotherGr)){
// 				return false;
// 			}
// 			const anotherSubArr = _allPrims.filter(primEl=>anotherGr.contains(primEl));
// 			return anotherSubArr.filter(primEl=>gr.includes(primEl)).length >= anotherSubArr.length*MIN_GR_OVERLAP_SAME_GROUPS;
// 		});
// 		res.isSameAs = []; // only roots can be "same as"
// 	}else{
// 		res.isSameAs = idArr.filter((id, idI)=>{
// 			const anotherGr = arr[idI];
// 			if(Array.isArray(anotherGr)){
// 				return false;
// 			}
// 			return anotherGr.isSameNode(gr);
// 		});
// 		res.isNestedIn = idArr.filter((id, idI)=>{
// 			const anotherGr = arr[idI];
// 			// note: arrays of elements are unique/non-overlapping -- no need to check them
// 			if(Array.isArray(anotherGr)){
// 				const elSubArr = _allPrims.filter(primEl=>gr.contains(primEl));
// 				return elSubArr.filter(primEl=>anotherGr.includes(primEl)).length >= elSubArr.length*MIN_GR_OVERLAP_SAME_GROUPS;
// 			}
// 			return !gr.isSameNode(anotherGr) && anotherGr.contains(gr);
// 		});
// 		res.containsGroups = idArr.filter((id, idI)=>{
// 			const anotherGr = arr[idI];
// 			// note: arrays of elements are unique/non-overlapping -- no need to check them
// 			if(Array.isArray(anotherGr)){
// 				return anotherGr.filter(primEl=>gr.contains(primEl)).length >= anotherGr.length*MIN_GR_OVERLAP_SAME_GROUPS;
// 			}
// 			return !gr.isSameNode(anotherGr) && gr.contains(anotherGr);
// 		});
// 	}
// 	res.containsGroups = res.containsGroups.join("+");
// 	res.isNestedIn = res.isNestedIn.join("+");
// 	res.isSameAs = res.isSameAs.join("+");
// 	return res;
// });


// var pageConsistsOfThinRows = false;
// // const MAX_HEADER_CANDIDATE_BOTTOM_COORD = MAX_HEADER_BOTTOM_COORD * 2;
// // const MAX_FOOTER_CANDIDATE_TOP_COORD
// 
// // 3 - If some headers are too low - below MAX_HEADER_BOTTOM_COORD, as we deliberately doubled MAX_HEADER_BOTTOM_COORD - fallback on the single element with the logo <== This all is to account for cases when the page is one giant Table with narrow rows - not all rows are headers
// 
// if(headers.filter(el=>window._getInnerBBox(el, {handleFloats: true}).top > MAX_HEADER_BOTTOM_COORD).length > 1){ // if >1 headEls fit within 1 and 2 of MAX_HEADER_BOTTOM_COORD
// 	pageConsistsOfThinRows = true;
// 	// return the top-most header than contains a Logo <-- no, it can be without logos + logos may be not in the top line
// 	// const logoEls = jqLogos.toArray();
// 	// headers = headers.filter(header=>logoEls.some(logo=>header.contains(logo)));
// 	if(headers.length > 1){
// 		headers = headers.filter((el)=>window._getFloatProofBBox(el).top < MIN_HEADER_HEIGHT);
// 		// headers = [headers.reduce((a, el)=>{
// 		// 	// if(el.getBoundingClientRect().top < a.getBoundingClientRect().top){
// 		// 	if(window._getFloatProofBBox(el).top < window._getFloatProofBBox(a).top){
// 		// 		return el;
// 		// 	}
// 		// 	return a;
// 		// })];
// 	}
// }
// // 4 - Footer detection -- almost the same as for headers
// var footers = _recursiveSearchForHeadersOrFooters(rootEl, allVisNonPrimitiveEls, jqVertMenus.toArray(), FULL_SCREEN_WIDTH, {ifHeaders: false});
// if(pageConsistsOfThinRows && footers.length > 1){
// 	// OPTIMIZE: DO the same check as for headers
// 	// Choose the bottom-most footer
// 	footers = footers.filter(el=>window._getFloatProofBBox(el).bottom > (window.window.getScrlEl().scrollHeight - MIN_HEADER_HEIGHT));
// 
// 	// footers = [footers.reduce((a, el)=>{
// 	// 	// if(a.getBoundingClientRect().top < el.getBoundingClientRect().top){
// 	// 	if(window._getFloatProofBBox(a).top < window._getFloatProofBBox(el).top){
// 	// 		return el;
// 	// 	}
// 	// 	return a;
// 	// })];
// }



// // EXTRA - disabling element selection to prevent DOM manipulation -- though we can't do much if they keep references
// w.eval(`Element.prototype.querySelector = (sel)=>{
// 	console.log("[PScript STUB] Page script tried to select a thing: ", sel, "Returning null instead.", window.location.href);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`Element.prototype.querySelectorAll = (sel)=>{
// 	console.log("[PScript STUB] Page script tried to select many things: ", sel, "Returning an empty arr instead.", window.location.href);
// 	${stopJsThrow}
// 	return [];
// }`);
// w.eval(`Element.prototype.after = ()=>{
// 	console.log("[PScript STUB]Page script tried to insert elements, 'after', Doing nothing instead.", window.location.href, this.tagName);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`Element.prototype.append = ()=>{
// 	console.log("[PScript STUB]Page script tried to insert elements, 'append', Doing nothing instead.", window.location.href, this.tagName);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`Element.prototype.before = ()=>{
// 	console.log("[PScript STUB]Page script tried to insert elements, 'before', Doing nothing instead.", window.location.href, this.tagName);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`Element.prototype.insertBefore = ()=>{
// 	console.log("[PScript STUB]Page script tried to insert elements, 'insertBefore', Doing nothing instead.", window.location.href, this.tagName);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`Element.prototype.insertAdjacentElement = ()=>{
// 	console.log("[PScript STUB]Page script tried to insert elements, 'insertAdjacentElement', Doing nothing instead.", window.location.href, this.tagName);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`Element.prototype.insertAdjacentHTML = ()=>{
// 	console.log("[PScript STUB]Page script tried to insert elements, 'insertAdjacentHTML', Doing nothing instead.", window.location.href, this.tagName);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`Element.prototype.prepend = ()=>{
// 	console.log("[PScript STUB]Page script tried to insert elements, 'prepend', Doing nothing instead.", window.location.href, this.tagName);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`Element.prototype.remove = ()=>{
// 	console.log("[PScript STUB]Page script tried to remove elements, 'remove', Doing nothing instead.", window.location.href, this.tagName);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`Element.prototype.replaceWith = ()=>{
// 	console.log("[PScript STUB]Page script tried to insert elements, 'replaceWith', Doing nothing instead.", window.location.href, this.tagName);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`Element.prototype.replaceChildren = ()=>{
// 	console.log("[PScript STUB]Page script tried to replace elements, 'replaceChildren', Doing nothing instead.", window.location.href, this.tagName);
// 	${stopJsThrow}
// 	return null;
// }`);



// // repeating replacements for HTMLDocument
// w.eval(`HTMLDocument.prototype.querySelector = (sel)=>{
// 	console.log("[PScript STUB]Page script tried to select a thing on HTMLDocument: ", sel, "Returning null instead.", window.location.href);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`HTMLDocument.prototype.querySelectorAll = (sel)=>{
// 	console.log("[PScript STUB]Page script tried to select many things on HTMLDoc: ", sel, "Returning an empty arr instead.", window.location.href);
// 	${stopJsThrow}
// 	return [];
// }`);
// // HTMLDocument get*
// w.eval(`HTMLDocument.prototype.getElementById = (sel)=>{
// 	console.log("[PScript STUB]Page script tried to getElementById: ", sel, "Returning null instead.", window.location.href);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`HTMLDocument.prototype.getElementsByClassName = (sel)=>{
// 	console.log("[PScript STUB]Page script tried to getElementsByClassName: ", sel, "Returning an empty arr instead.", window.location.href);
// 	${stopJsThrow}
// 	return [];
// }`);
// w.eval(`HTMLDocument.prototype.getElementsByName = (sel)=>{
// 	console.log("[PScript STUB]Page script tried to getElementsByName: ", sel, "Returning an empty arr instead.", window.location.href);
// 	${stopJsThrow}
// 	return [];
// }`);
// w.eval(`HTMLDocument.prototype.getElementsByTagName = (sel)=>{
// 	console.log("[PScript STUB]Page script tried to getElementsByTagName: ", sel, "Returning an empty arr instead.", window.location.href);
// 	${stopJsThrow}
// 	return [];
// }`);
// w.eval(`HTMLDocument.prototype.getElementsByTagNameNS = (sel)=>{
// 	console.log("[PScript STUB]Page script tried to getElementsByTagNameNS: ", sel, "Returning an empty arr instead.", window.location.href);
// 	${stopJsThrow}
// 	return [];
// }`);




// w.eval(`Node.prototype.appendChild = ()=>{
// 	console.log("[PScript STUB]Page script tried to insert elements, 'appendChild', Doing nothing instead.", window.location.href, this.tagName);
// 	${stopJsThrow}
// 	return null;
// }`);
// w.eval(`Node.prototype.replaceChild = ()=>{
// 	console.log("[PScript STUB]Page script tried to insert elements, 'replaceChild', Doing nothing instead.", window.location.href, this.tagName);
// 	${stopJsThrow}
// 	return null;
// }`);
// // Disabling removing -- apparently some pages use these and not 'replace'
// w.eval(`Node.prototype.removeChild = ()=>{
// 	console.log("[PScript STUB]Page script tried to remove Child elements, 'removeChild', Doing nothing instead.", window.location.href, this);
// 	${stopJsThrow}
// 	return null;
// }`);
