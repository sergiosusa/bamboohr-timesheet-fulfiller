// ==UserScript==
// @name         Bamboohr Timesheet Fulfiller
// @namespace    bamboohr.timesheet
// @version      0.5
// @description  Script to fulfiller the Bamboohr timesheet monthly
// @author       Sergio Susa (sergio@sergiosusa.com)
// @match        https://*.bamboohr.com/employees/timesheet/?id=*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bamboohr.com
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

const SCHEDULE_TEMPLATE = {
    'default': [
        {
            start: '9:15',
            end: '17:30'
        }
    ],
    'Fri':[
        {
            start: '9:15',
            end: '14:00'
        }
    ]
};

const DEFAULT_ENTROPY_MINUTES = 15;

(function () {
    'use strict';
    try {
        let bambooHr = new BambooHr();
        bambooHr.render();
    } catch (exception) {
        alert(exception);
    }
})();

function BambooHr() {
    this.render = () => {
        let optionContainer = document.querySelector(".TimesheetSummary__dailyGraph");

        optionContainer.innerHTML =
            '<div class="TimesheetSummary__clockButtonWrapper">' +
            '   <button id="fillBtn" type="button" class="fab-Button fab-Button--small fab-Button--width100">Fill Month</button>' +
            '</div>' +
            '<div class="TimesheetSummary__clockButtonWrapper">' +
            '   <button id="unfillBtn"  type="button" class="fab-Button fab-Button--small fab-Button--width100">Unfill Month</button>' +
            '</div>' + optionContainer.innerHTML;

        document.querySelector("#fillBtn").onclick = this.fill;
        document.querySelector("#unfillBtn").onclick = this.unfill;
    };

    this.fill = () => {
        let timesheetData = JSON.parse(document.getElementById('js-timesheet-data').innerHTML);
        let tracking_id = 0;
        let skipped = [];
        let entries = [];

        for (const [day, details] of Object.entries(timesheetData.timesheet.dailyDetails)) {
            let date = new Date(day);

            /* Skip weekend */
            if ([0, 6].includes(date.getDay())) {
                continue;
            }

            /* Skip holidays & time off */
            let skip_reasons = [];

            skip_reasons.push(...details.holidays.map(h => `${h.name.trim()} (${h.paidHours} hours)`));
            skip_reasons.push(...details.timeOff.map(t => `${t.type.trim()} (${t.amount} ${t.unit})`));

            if (skip_reasons.length > 0) {
                skipped.push(`${day}: ${skip_reasons.join(", ")}`);
                continue;
            }

            /* Get the working time slots for the dow */
            let dow = date.toLocaleDateString("en-US", {weekday: 'short'});
            let slots = SCHEDULE_TEMPLATE['default'];

            if (SCHEDULE_TEMPLATE.hasOwnProperty(dow)) {
                slots = SCHEDULE_TEMPLATE[dow];
            }

            /* Generate the entries for this day */
            let minute_diff = [...Array(slots.length)].map(_ => Math.ceil(Math.random() * DEFAULT_ENTROPY_MINUTES));

            for (const [idx, slot] of slots.entries()) {
                tracking_id += 1;

                let start = new Date(`${day} ${slot.start}`)
                start.setMinutes(start.getMinutes() + minute_diff[idx])

                let end = new Date(`${day} ${slot.end}`)
                end.setMinutes(end.getMinutes() + minute_diff[minute_diff.length - 1 - idx])

                entries.push({
                    id: null,
                    trackingId: tracking_id,
                    employeeId: unsafeWindow.currentlyEditingEmployeeId,
                    date: day,
                    start: `${start.getHours()}:${('0' + start.getMinutes()).slice(-2)}`,
                    end: `${end.getHours()}:${('0' + end.getMinutes()).slice(-2)}`,
                    note: ''
                });
            }
        }

        fetch(
            `${window.location.origin}/timesheet/clock/entries`,
            {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin',
                headers: {
                    'content-type': 'application/json; charset=UTF-8',
                    'x-csrf-token': unsafeWindow.CSRF_TOKEN
                },
                body: JSON.stringify({ entries: entries })
            }
        ).then(data => {
            if (data.status === 200) {
                alert(`Created ${entries.length} entries.\n\nSkipped days:\n${skipped.join('\n')}`);
                location.reload();
            } else {
                data.text().then(t => alert(`Request error!\nHTTP Code: ${data.status}\nResponse:\n${t}`));
            }
        }).catch(err => alert(`Fetch error!\n\n${err}`));

        return false;
    };

    this.unfill = () => {

        let tsd = JSON.parse(document.getElementById('js-timesheet-data').innerHTML);
        let entries = [];

        /* Grab all entries ids */
        for (const [day, details] of Object.entries(tsd.timesheet.dailyDetails)) {
            for (const entry of details.clockEntries) {
                entries.push(entry.id)
            }
        }

        fetch(
            `${window.location.origin}/timesheet/clock/entries`,
            {
                method: 'DELETE',
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin',
                headers: {
                    'content-type': 'application/json; charset=UTF-8',
                    'x-csrf-token': unsafeWindow.CSRF_TOKEN
                },
                body: JSON.stringify({ entries: entries })
            }
        ).then(data => {
            if (data.status === 200) {
                alert(`Deleted ${entries.length} entries.`);
                location.reload();
            } else {
                data.text().then(t => alert(`Request error!\nHTTP Code: ${data.status}\nResponse:\n${t}`));
            }
        }).catch(err => alert(`Fetch error!\n\n${err}`));

        return false;
    };
}

