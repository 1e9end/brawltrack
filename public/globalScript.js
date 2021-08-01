var navOn = false;
function toggleNav() {
	if (!navOn){
		document.getElementById("sidenav").style.width = "250px";
		navOn = true;
		return;
	}

	document.getElementById("sidenav").style.width = "0";
	navOn = false;
}

window.addEventListener('resize', event => {
	let scrollbar = document.getElementById("leaderboard").offsetWidth - document.getElementById("leaderboard").clientWidth;
	document.getElementById("leaderboard-header").style.paddingRight = `${scrollbar}px`;
}, true);

let scrollbar = document.getElementById("leaderboard").offsetWidth - document.getElementById("leaderboard").clientWidth;
document.getElementById("leaderboard-header").style.paddingRight = `${scrollbar}px`;