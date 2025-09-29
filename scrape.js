const puppeteer = require("puppeteer");
const fs = require("fs");

async function scrapeAndGenerateICS() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"], // Required for GitHub Actions environment
  });
  const page = await browser.newPage();
  await page.goto(
    "https://www.truenorthhockey.com/Stats/StatsTeamStats?divteamID=851#ScheduleAnchor",
    {
      waitUntil: "networkidle2",
      timeout: 30000,
    }
  );

  // Wait for the schedule section to load
  await page
    .waitForSelector("#ScheduleAnchor", { timeout: 10000 })
    .catch(() => console.log("Schedule anchor not found; proceeding anyway."));

  // Extract team name (assume it's in <h1> or adjust selector)
  const teamName = await page.evaluate(() => {
    const heading =
      document.querySelector("h1") || document.querySelector("h2");
    return heading ? heading.textContent.trim() : "My Team";
  });

  // Extract games from the table (adjust selector if table is not directly after #ScheduleAnchor)
  const games = await page.evaluate(() => {
    const table =
      document.querySelector("#ScheduleAnchor + table") ||
      document.querySelector("table.schedule") ||
      document.querySelector("table");
    if (!table) return [];

    const rows = table.querySelectorAll("tr");
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      // Skip header row
      const cells = rows[i].querySelectorAll("td, th");
      if (cells.length >= 5) {
        data.push({
          date: cells[0].textContent.trim(),
          time: cells[1].textContent.trim(),
          rink: cells[2].textContent.trim(),
          home: cells[3].textContent.trim(),
          away: cells[4].textContent.trim(),
          score: cells[5] ? cells[5].textContent.trim() : "",
        });
      }
    }
    return data;
  });

  await browser.close();

  // Generate ICS file
  let icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//${teamName} Schedule//EN\n`;
  games.forEach((game, index) => {
    // Parse date and time (assumes format like "Sep 29, 2025 10:00 PM"; adjust if needed)
    const dateTimeStr = `${game.date} ${game.time}`;
    const startDate = new Date(Date.parse(dateTimeStr));
    if (isNaN(startDate)) {
      console.log(`Invalid date for game ${index}: ${dateTimeStr}`);
      return;
    }
    const endDate = new Date(startDate.getTime() + 90 * 60 * 1000); // 90-minute game

    const formatISO = (date) =>
      date.toISOString().replace(/-/g, "").replace(/:/g, "").split(".")[0] +
      "Z";

    const summary = `${game.home} vs ${game.away}`;
    const description = `Score: ${game.score || "TBD"}\nRink: ${game.rink}`;
    const uid = `${formatISO(startDate)}-${index}@hockeyschedule.com`;

    icsContent += `BEGIN:VEVENT\n`;
    icsContent += `UID:${uid}\n`;
    icsContent += `DTSTAMP:${formatISO(new Date())}\n`;
    icsContent += `DTSTART:${formatISO(startDate)}\n`;
    icsContent += `DTEND:${formatISO(endDate)}\n`;
    icsContent += `SUMMARY:${summary}\n`;
    icsContent += `LOCATION:${game.rink}\n`;
    icsContent += `DESCRIPTION:${description}\n`;
    icsContent += `END:VEVENT\n`;
  });
  icsContent += "END:VCALENDAR\n";

  fs.writeFileSync("calendar.ics", icsContent);
  console.log("ICS file generated.");
}

scrapeAndGenerateICS().catch(console.error);
