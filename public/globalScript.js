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

function toggleHistory(x){
	if (x){
		document.getElementById("history").style.display = "block";
		document.getElementById("leaderboard").style.display = "none";
		document.getElementById("previous-toggle").style.backgroundColor = "#DF7C3C";
		document.getElementById("current-toggle").style.backgroundColor = "#3E393F";
		return;
	}

	document.getElementById("leaderboard").style.display = "block";
	document.getElementById("history").style.display = "none";
	document.getElementById("current-toggle").style.backgroundColor = "#DF7C3C";
	document.getElementById("previous-toggle").style.backgroundColor = "#3E393F";
}