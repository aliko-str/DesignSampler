/*eslint-env browser */

(function () {
	const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed risus est, semper vel dolor at, sagittis condimentum nulla. Nam rhoncus congue odio, at euismod turpis fermentum at. Nunc congue neque et vehicula efficitur. Cras et augue mollis, pretium sem nec, pulvinar tortor. Quisque quis sagittis enim, vel imperdiet ipsum. Nunc ornare, risus vitae vehicula sodales, leo urna aliquam tortor, vel aliquet mauris arcu nec odio. Praesent finibus maximus orci, a congue metus laoreet nec. Nullam ornare ut ante vitae pellentesque. Praesent pulvinar libero at pretium rutrum. Maecenas semper turpis sit amet erat aliquam, sed semper ante condimentum. Mauris faucibus, nisi at vulputate condimentum, justo eros cursus quam, vitae commodo tortor arcu non nisl. Morbi elementum maximus iaculis. Morbi vulputate pellentesque augue quis ultricies. Nam eleifend mi libero, ac laoreet nisi dictum ac. Phasellus at varius erat. Nam sed magna id ex molestie fermentum vel vitae mauris. Sed urna dui, aliquam eu diam in, mattis tincidunt leo. Sed euismod enim eget dictum lacinia. Integer auctor, turpis vitae consectetur suscipit, nibh sapien cursus metus, id ullamcorper tortor quam at dui. Duis ac elit elit. Sed sed felis dolor. Proin sagittis felis vitae quam ultrices rutrum. Cras odio tellus, tincidunt id pellentesque in, commodo id velit. Nam molestie diam leo, id aliquam lacus feugiat eu. Morbi hendrerit feugiat pulvinar. Nunc tempus blandit elit sed pretium. Quisque tempor urna sapien.';
	const theSpan = document.createElement('span');
	theSpan.style.whiteSpace = 'nowrap';

	window._textWidthInCharacters = function (el) {
		var res = 0;
		var _padding;
		const elStyle = window.getComputedStyle(el);
		// const targetWidth = parseInt(elStyle["width"].replace("px", ""));
		try {
			_padding = parseInt(elStyle["paddingLeft"].replace("px", "")) + parseInt(elStyle["paddingRight"].replace("px", ""));
		} catch (err) {
			console.error("Couldn't parse padding, it's: ", elStyle["paddingLeft"], " and ", elStyle["paddingright"]);
			_padding = 0;
		}
		const targetWidth = el.offsetWidth - _padding;
		if (targetWidth < 0) {
			console.error("Width can't be below zero, components: (width) ", el.offsetWidth, ' and padding ', _padding);
		}
		if (targetWidth) {
			document.body.appendChild(theSpan);
			// define the style
			theSpan.style.fontFamily = elStyle["fontFamily"];
			theSpan.style.fontSize = elStyle["fontSize"];
			// count the charaters
			var i = 0;
			while (theSpan.offsetWidth < targetWidth) {
//				if (theSpan.offsetWidth >= window.innerWidth) {
//					console.error("TEXT WIDTH: An element wider than window --> skipping any further width increments");
//					break;
//				}
				theSpan.innerHTML += text[i];
				i++;
				if (i >= text.length) {
					console.error("I'd never expect this situation: all our test text fits in one line... Just return the maximum");
					break;
				}
			}
			res = i - 1;
			// clean it up		
			theSpan.innerHTML = "";
			document.body.removeChild(theSpan);
		}
		return res;
	};

})();
