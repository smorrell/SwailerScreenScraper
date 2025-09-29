// scrape.js
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const ics = require("ics");
const fs = require("fs");

const TEAM_URL = "https://www.truenorthhockey.com/Stats/StatsTeamStats?divteamID=851#ScheduleAnchor";

async function scrapeSchedule() {
  const res = await fetch(TEAM_URL);
  const html = await res.text();
  const $ = cheerio.load(html);

  let events = [];

  $("#ScheduleAnchor").closest("table").find("tr").each((i, row) => {
    const cols = $(row).find("td");
    if (cols.length > 0) {
      const dateStr = $(cols[0]).text().trim();
      const timeStr = $(cols[1]).text().trim();
      const opponent = $(cols[2]).text().trim();
      const location = $(cols[3]).text().trim();

      if (dateStr && timeStr) {
        const dateTime = new Date(`${dateStr} ${timeStr} EST`);

        const event = {
          title: `Hockey vs ${opponent}`,
          start: [
            dateTime.getFullYear(),
            dateTime.getMonth() + 1,
            dateTime.getDate(),
            dateTime.getHours(),
            dateTime.getMinutes(),
          ],
          duration: { hours: 1, minutes: 0 },
          location,
        };
        events.push(event);
      }
    }
  });

  return events;
}

(async () => {
  const events = await scrapeSchedule();
  const { error, value } = ics.createEvents(events);
  if (error) throw error;
  fs.writeFileSync("calendar.ics", value);
  console.log("✅ calendar.ics generated");
})();
