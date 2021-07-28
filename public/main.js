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

function changeClub(){
	let tag = document.getElementById("club-selector-tag").value;
	window.location.replace("http://www.brawltrack.com/club/" + tag);
}

window.addEventListener('resize', event => {
    let scrollbar = document.getElementById("leaderboard").offsetWidth - document.getElementById("leaderboard").clientWidth;
	document.getElementById("leaderboard-header").style.paddingRight = `${scrollbar}px`;
}, true);

let scrollbar = document.getElementById("leaderboard").offsetWidth - document.getElementById("leaderboard").clientWidth;
document.getElementById("leaderboard-header").style.paddingRight = `${scrollbar}px`;