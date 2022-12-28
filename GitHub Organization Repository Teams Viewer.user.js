// ==UserScript==
// @name         GitHub Organization Repository Teams Viewer
// @namespace    http://www.thomasstockwell.com/
// @version      0.7
// @description  try to take over the world!
// @author       Thomas Stockwell
// @match        https://github.com/**
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @downloadURL  https://github.com/tomstock1337/tampermonkey-github-org-team-viewer/raw/main/GitHub%20Organization%20Repository%20Teams%20Viewer.user.js
// @updateURL    https://github.com/tomstock1337/tampermonkey-github-org-team-viewer/raw/main/GitHub%20Organization%20Repository%20Teams%20Viewer.user.js
// @grant        GM_xmlhttpRequest
// @connect      github.com
// ==/UserScript==
/* globals jQuery, $, waitForKeyElements */

(function () {
  "use strict";

  const pageOrgRepoRegex =
    /(https?:\/\/(www\.)?github\.com\/orgs\/)([^\/]*)\/repositories\/?/;
  const pageOrgProfileRegex = /(https?:\/\/(www\.)?github\.com\/)([^\/]*)\/?$/;
  const pageOrgTeamProfileRegex =
    /(https?:\/\/(www\.)?github\.com\/orgs\/)([^\/]*)\/teams\/([^\/]*)\/repositories\/?/;
  const urlOrgsBase = "https://www.github.com/orgs/";
  const urlGitHubBase = "https://www.github.com";
  const pill =
    '<span class="label v-align-middle" style="border-color:{color};color:white">{pilltext}</span>';
  var pageURL = window.location.href;
  var pageURLArray;
  var org;

  // See if page that loaded requires repository changes
  validatePage();

  // Listen for changes to the URL
  setInterval(function () {
    if (pageURL != location.href) {
      pageURL = location.href;
      validatePage();
    }
  }, 500);

  function validatePage() {
    var orgRepos;
    // page has changed, set new page as 'current'
    if (pageURL.match(pageOrgRepoRegex)) {
      orgRepos = $("div#org-repositories");
      pageURLArray = pageOrgRepoRegex.exec(pageURL);
      //[0] = https://github.com/orgs/orgname/repositories
      //[1] = https://github.com/orgs/
      //[2] = www.
      //[3] = orgname
      org = pageURLArray[3];
      addRepoTeams(org);
    } else if (pageURL.match(pageOrgProfileRegex)) {
      orgRepos = $("div#org-profile-repositories");
      if (orgRepos.length > 0) {
        pageURLArray = pageOrgProfileRegex.exec(pageURL);
        //[0] = https://github.com/orgname
        //[1] = https://github.com/
        //[2] = www.
        //[3] = orgname
        org = pageURLArray[3];
        addRepoTeams(org, orgRepos);
      }
    } else if (pageURL.match(pageOrgTeamProfileRegex)) {
      orgRepos = $("div#org-team-repositories");
      if (orgRepos.length > 0) {
        pageURLArray = pageOrgTeamProfileRegex.exec(pageURL);
        //[0] = https://github.com/orgs/umd-its/teams/applications-team/repositories
        //[1] = https://github.com/orgs/
        //[2] =
        //[3] = orgname
        //[4] = teamname=
        addRepoTeams(pageURLArray[3], orgRepos);
      }
    }
  }

  function addRepoTeams(org, orgRepos) {
    var colors = ["#F73F0C", "#B50BD4", "#003BEB", "#0BD48F", "#93F500"];
    var debug = true;
    var orgTeams = [];
    var stage1 = "Processing";
    var stage2cntTeamsProcessed = 0;

    if (debug) console.log("Stage 1 Start");
    if (debug) console.log(urlOrgsBase + org + "/teams");

    //Grab all teams of the organization.  Pagination may be an issue for larger orgs
    GM_xmlhttpRequest({
      method: "GET",
      url: urlOrgsBase + org + "/teams",
      onload: function (orgTeamsPage) {
        var orgTeamsPageCode = $.parseHTML(orgTeamsPage.responseText);
        var links = $("div#org-teams ul li a[id^=team]", orgTeamsPageCode);
        $.each(links, (obj) => {
          var teamName = $("span", links[obj]).text();
          var teamURL = $(links[obj]).attr("href");
          var color = colors[obj];
          orgTeams.push({ Name: teamName, URL: teamURL, Color: color });
        });
        console.log(orgTeams);
        stage1 = "Finished";
      },
    });

    // For each team, determine what repositories they have access to.  Pagination may be an issue for larger orgs
    function stage2start() {
      if (stage1 !== "Finished") {
        window.setTimeout(
          stage2start,
          100
        ); /* this checks the flag every 100 milliseconds*/
      } else {
        if (debug) console.log("Stage 2 Start");
        if (debug) console.log(orgTeams);

        orgTeams.forEach((obj, i) => {
          if (debug) console.log(urlGitHubBase + obj.URL + "/repositories");
          GM_xmlhttpRequest({
            method: "GET",
            url: urlGitHubBase + obj.URL + "/repositories",
            onload: function (orgTeamsPage) {
              var orgTeamsPageCode = $.parseHTML(orgTeamsPage.responseText);
              var links = $(
                "div#org-team-repositories ul li a[data-hovercard-type='repository']",
                orgTeamsPageCode
              );
              var linkArray = [];
              $.each(links, (i2) => {
                var teamRepoUrl = $(links[i2]).attr("href");
                linkArray.push(teamRepoUrl);
                // orgTeams.push({Name:teamName,URL:teamURL,Color:color});
              });
              orgTeams[i].Repos = linkArray;
              stage2cntTeamsProcessed++;
            },
          });
        });

        //Add pills to the necessary pages to display what teams are a part of what repositories.
        function stage3Start() {
          if (stage2cntTeamsProcessed != orgTeams.length) {
            window.setTimeout(
              stage3Start,
              100
            ); /* this checks the flag every 100 milliseconds*/
          } else {
            if (debug) console.log("Stage 3 Start");

            //Adjustments of the UI on the repository page
            var orgReposList = $(
              "ul li a[data-hovercard-type='repository']",
              orgRepos
            );
            $.each(orgReposList, (i3) => {
              var repoURL = $(orgReposList[i3]).attr("href");
              var repoList = $(
                "ul li div[itemType='http://schema.org/Code']",
                orgRepos
              );
              var repoTeams = [];
              var pills = $("<div></div>");

              // For each team, go over the repositories to see if they match the current repository
              orgTeams.forEach((obj4, i4) => {
                obj4.Repos.forEach((obj5, i5) => {
                  if (repoURL === obj5) {
                    repoTeams.push(obj4);
                  }
                });
              });

              repoTeams.forEach((obj4, i4) => {
                pills.append(
                  $(
                    pill
                      .replace("{pilltext}", obj4.Name)
                      .replace("{color}", obj4.Color)
                  )
                );
              });

              $(orgReposList[i3]).append(pills);
            });
          }
        }
        stage3Start();
      }
    }
    stage2start();
  }
})();
