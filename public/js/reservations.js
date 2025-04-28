$(document).ready(function() {
    // --- Global Variables & References ---
    const today = moment().format('YYYY-MM-DD');
    // Define maxDate clearly - 3 months from today
    const maxMoment = moment().add(3, 'months');
    const maxDateInput = maxMoment.format('YYYY-MM-DD'); // Inclusive for input max
    const maxDateCalendarEnd = maxMoment.add(1, 'day').format('YYYY-MM-DD'); // Exclusive end for calendar validRange

    const $dateInput = $('#date');
    const $partySizeSelect = $('#numberOfPeople');
    const $timeSelect = $('#time');
    const $timeLoader = $('#time-loader');
    const $reservationForm = $('#reservationForm');
    const $messageDiv = $('#reservationMessage');
    const $submitButton = $('#submitButton');
    const $buttonText = $('#buttonText');
    const $buttonSpinner = $('#buttonSpinner');
    const restaurantPhoneNumber = '(703) 319-2700';

    // --- State Variable ---
    let highlightedDate = $dateInput.val() || today;

    // --- Helper Function to Apply/Remove Highlight with Logging ---
    function applyCalendarHighlight(dateStr) {
        console.log(`[applyCalendarHighlight] Called with dateStr: '${dateStr || 'null/undefined'}'`);

        // 1. Always remove highlight from all day cells first
        const $allDays = $('.fc-day');
        if ($allDays.hasClass('fc-day-selected-highlight')) {
            console.log(`[applyCalendarHighlight] Removing 'fc-day-selected-highlight' from ${$allDays.length} elements.`);
            $allDays.removeClass('fc-day-selected-highlight');
        } else {
            console.log("[applyCalendarHighlight] No existing highlights found to remove.");
        }


        // 2. Apply highlight to the specific date if provided
        if (dateStr) {
            const cellSelector = `.fc-day[data-date="${dateStr}"]`;
            console.log(`[applyCalendarHighlight] Attempting to highlight cell with selector: "${cellSelector}"`);

            // Use timeout to ensure element exists after potential view changes
            setTimeout(() => {
                const $targetCell = $(cellSelector); // Find the cell *inside* the timeout

                if ($targetCell.length > 0) {
                     // Check if it ALREADY has the class before adding (optional, but informative)
                    if (!$targetCell.hasClass('fc-day-selected-highlight')) {
                        console.log(`[applyCalendarHighlight] Adding 'fc-day-selected-highlight' to element:`, $targetCell[0]); // Log the raw DOM element
                        $targetCell.addClass('fc-day-selected-highlight');
                    } else {
                         console.log(`[applyCalendarHighlight] Element already has highlight class:`, $targetCell[0]);
                    }
                } else {
                    console.warn(`[applyCalendarHighlight] Could not find element with selector "${cellSelector}" to highlight.`);
                }
            }, 0); // Timeout 0ms still defers execution until after current stack clears
        } else {
            console.log("[applyCalendarHighlight] dateStr is null or empty, only clearing highlights (done above).");
        }
    }

    // --- Calendar Initialization ---
    $('#calendar').fullCalendar({
        header: { left: 'prev', center: 'title', right: 'next' },
        defaultDate: today,
        navLinks: false,
        editable: false,
        eventLimit: true,
        selectable: true,
        selectHelper: true,
        validRange: { start: today, end: maxDateCalendarEnd },
        dayRender: function (date, cell) {
            const dateStr = date.format('YYYY-MM-DD');
            cell.attr('data-date', dateStr);
            if (dateStr < today) {
                cell.addClass('fc-past');
            }
            // Apply highlight based on state during initial render/navigation
            // Note: This might cause a console log from applyCalendarHighlight if called AFTER viewRender
            if (dateStr === highlightedDate) {
                 // Directly add class here as the cell is guaranteed to exist
                 // This avoids potential race conditions with the async applyCalendarHighlight
                 if (!cell.hasClass('fc-day-selected-highlight')) {
                    console.log(`[dayRender] Adding initial highlight to ${dateStr}`);
                    cell.addClass('fc-day-selected-highlight');
                 }
            }
        },
        dayClick: function(date, jsEvent, view) {
            const clickedDateStr = date.format('YYYY-MM-DD');
            const todayDateStr = moment().format('YYYY-MM-DD');
            if (clickedDateStr < todayDateStr) {
                return; // Ignore past dates
            }
            console.log(`[dayClick] Clicked on: ${clickedDateStr}`);
            highlightedDate = clickedDateStr;      // Update state
            applyCalendarHighlight(clickedDateStr); // Apply visual highlight (logs inside)
            $dateInput.val(clickedDateStr);        // Update input value
            $dateInput.trigger('change', ['calendarClick']); // Trigger change
        },
        viewRender: function(view, element) {
            // Re-apply highlight after view changes (gotoDate, prev/next) using the state
            console.log(`[viewRender] View changed. Applying highlight based on state: '${highlightedDate}'`);
            applyCalendarHighlight(highlightedDate); // This call will log details
        }
    });

    // Set date input attributes
    $dateInput.attr('min', today);
    $dateInput.attr('max', maxDateInput);
    $dateInput.val(today);
    highlightedDate = today; // Ensure initial state matches input

    // --- Function to Fetch Available Times (Keep existing) ---
    function fetchAvailableTimes(selectedDate, partySize) {
         console.log(`[fetchAvailableTimes] Date: ${selectedDate}, Party: ${partySize}`); // Add basic log
         $timeSelect.html('<option value="" disabled selected>Select date & guests first</option>').prop('disabled', true); $messageDiv.html(''); if (!selectedDate || !partySize) return; $timeLoader.removeClass('hidden').addClass('flex'); $timeSelect.prop('disabled', true);
         fetch(`/availability?date=${selectedDate}&partySize=${partySize}`)
             .then(response => { $timeLoader.addClass('hidden').removeClass('flex'); if (!response.ok) { return response.json().then(errData => { throw new Error(errData.error || `Server error: ${response.status}`); }).catch(() => { throw new Error(`Network response was not ok: ${response.status}`); }); } return response.json(); })
             .then(data => { populateTimeSlotsClientSideCheck(data.slots, partySize, selectedDate); })
             .catch(error => { console.error('Error fetching times:', error); $timeSelect.empty().append('<option value="" disabled selected>Error loading times</option>').prop('disabled', true); $messageDiv.html(`<span class="text-red-400 text-sm">Could not load times: ${error.message}. Please try again or call us.</span>`); });
    }

    // --- Function to Populate Time Slot Dropdown (Keep existing) ---
    function populateTimeSlotsClientSideCheck(slots, requestedPartySize, selectedDate) {
         console.log(`[populateTimeSlots] Populating for ${selectedDate}`); // Add basic log
         $timeSelect.empty(); let availableSlotsFound = false; const nowClient = moment();
         if (!slots || slots.length === 0) { $timeSelect.append('<option value="" disabled selected>No times available</option>'); $messageDiv.html(`<span class="text-secondary-light text-sm">Sorry, no online reservations are available for ${requestedPartySize} guest(s) on this date. Please try another date or call us at <a href="tel:${restaurantPhoneNumber}" class="underline hover:text-primary">${restaurantPhoneNumber}</a>.</span>`); $timeSelect.prop('disabled', true); return; }
         $timeSelect.append('<option value="" disabled selected>Select an available time</option>');
         slots.forEach(slot => { const option = $('<option></option>'); option.val(slot.time); let displayText = slot.displayTime; let isDisabled = false; let isPast = false; const slotDateTime = moment(selectedDate + ' ' + slot.time, 'YYYY-MM-DD HH:mm'); if (slotDateTime.isBefore(nowClient)) { isPast = true; isDisabled = true; displayText += ' (Past)'; option.addClass('unavailable'); } if (!isPast) { const status = slot.status || 'available'; const availableSeats = slot.availableSeats; switch(status) { case 'available': availableSlotsFound = true; break; case 'limited': availableSlotsFound = true; if (availableSeats) displayText += ` (Only ${availableSeats} seat${availableSeats > 1 ? 's' : ''} left)`; break; case 'full': displayText += ' (Booked)'; isDisabled = true; option.addClass('unavailable'); break; default: displayText += ' (Unavailable)'; isDisabled = true; option.addClass('unavailable'); break; } } option.text(displayText); option.prop('disabled', isDisabled); $timeSelect.append(option); });
         if (!availableSlotsFound) { if (slots.length > 0) { $timeSelect.find('option:not([disabled])').remove(); $timeSelect.prepend('<option value="" disabled selected>No suitable times available</option>'); $messageDiv.html(`<span class="text-secondary-light text-sm">Sorry, we don't have availability for ${requestedPartySize} guest(s) at any time on this date. Please try another date or call us at <a href="tel:${restaurantPhoneNumber}" class="underline hover:text-primary">${restaurantPhoneNumber}</a>.</span>`); } $timeSelect.prop('disabled', true); } else { $timeSelect.prop('disabled', false); }
    }

    // --- Event Listeners for Date and Party Size Changes ---
    $dateInput.add($partySizeSelect).on('change', function(event, source) {
        const selectedDate = $dateInput.val();
        const partySize = $partySizeSelect.val();
        const $target = $(event.target);
        const todayDateStr = moment().format('YYYY-MM-DD');

        console.log(`--- Change Event Start ---`);
        console.log(`Source: ${source || 'Input/Select Change'}`);
        console.log(`Target Element ID: ${$target.attr('id')}`);
        console.log(`Selected Date: ${selectedDate}`);
        console.log(`Party Size: ${partySize}`);
        console.log(`Current highlightedDate State before update: ${highlightedDate}`);

        // 1. Update internal highlight state ONLY if change didn't come from calendar click
        if (source !== 'calendarClick') {
            highlightedDate = selectedDate ? selectedDate : null; // Update state or clear if date removed
            console.log(`Updated highlightedDate State to: ${highlightedDate}`);
        }

        // 2. Handle Calendar Navigation and Highlighting (Primarily driven by Date Input Change)
        if (source !== 'calendarClick' && $target.is($dateInput)) {
             // Change originated from the #date input field
             if (selectedDate) {
                 console.log(`Input Change: Navigating calendar view using gotoDate(${selectedDate})...`);
                 try {
                    $('#calendar').fullCalendar('gotoDate', selectedDate);
                    applyCalendarHighlight(highlightedDate);
                 } catch (e) {
                    console.error("Error during gotoDate execution:", e);
                 }
             } else {
                 // Date input was cleared
                 console.log("Input Change: Date input cleared, removing visual highlight.");
                 applyCalendarHighlight(null); // Clear visual highlight explicitly
             }
        }
        // 3. Handle Highlighting if change was from Party Size or Calendar Click
        //    (No navigation needed, just ensure highlight matches state)
        else if (selectedDate) {
             console.log("Party/Calendar Change: Applying highlight based on state:", highlightedDate);
             applyCalendarHighlight(highlightedDate);
        }
        // 4. Handle case where date might be cleared indirectly
        else {
             console.log("Change Event: Date is empty, ensuring highlight is cleared.");
             applyCalendarHighlight(null);
        }

        // 5. Always fetch times if date/party are selected
        fetchAvailableTimes(selectedDate, partySize);
        console.log(`--- Change Event End ---`);
    });


    // --- Form Submission Logic (Keep existing) ---
    $reservationForm.submit(function (e) {
         e.preventDefault(); let isValid = true; $('.text-red-400.text-xs').text(''); $messageDiv.html('');
         if (!$('#name').val()) { $('#name-error').text('Name is required.'); isValid = false; } if (!$('#email').val() || !/^\S+@\S+\.\S+$/.test($('#email').val())) { $('#email-error').text('Valid email is required.'); isValid = false; } if (!$partySizeSelect.val()) { $('#people-error').text('Party size is required.'); isValid = false; } if (!$dateInput.val()) { $('#date-error').text('Date is required.'); isValid = false; } if (!$timeSelect.val() || $timeSelect.find('option:selected').prop('disabled')) { $('#time-error').text('Please select an available time slot.'); isValid = false; }
         if (!isValid) { $messageDiv.html('<span class="text-red-400 text-sm">Please correct the errors above.</span>'); $('.text-red-400.text-xs').not(':empty').first().closest('div').find('input, select, textarea').first().focus(); return; }
         $messageDiv.html(''); $buttonText.text('Sending Request...'); $buttonSpinner.removeClass('hidden'); $submitButton.prop('disabled', true).addClass('opacity-75 cursor-not-allowed');
         const formData = { name: $('#name').val(), email: $('#email').val(), numberOfPeople: $partySizeSelect.val(), date: $dateInput.val(), time: $timeSelect.val(), specialRequests: $('#specialRequests').val() || '', };
         fetch('/reserve', { method: 'POST', headers: { 'Content-Type': 'application/json', }, body: JSON.stringify(formData) })
         .then(response => { if (!response.ok) { return response.json().catch(() => { throw new Error(`Server responded with status: ${response.status}`); }).then(err => { throw err; }); } return response.json(); })
         .then(data => { $messageDiv.html(`<div class="p-4 bg-green-600/20 border border-green-500 rounded-lg text-green-300 text-sm"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline -mt-1 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>${data.message || 'Request sent! Please check your email to verify.'}</div>`); $reservationForm[0].reset(); $timeSelect.html('<option value="" disabled selected>Select date & guests first</option>').prop('disabled', true); $dateInput.val(''); $partySizeSelect.val(''); highlightedDate = null; applyCalendarHighlight(null); $('.text-red-400.text-xs').text(''); $messageDiv.append('<div class="mt-2 text-xs text-neutral-light/70">Form reset. Select details for a new reservation.</div>'); setTimeout(() => { $buttonText.text('Request Reservation'); $buttonSpinner.addClass('hidden'); $submitButton.prop('disabled', false).removeClass('opacity-75 cursor-not-allowed'); }, 1500); })
         .catch(error => { console.error('Error during fetch:', error); let errorMessage = "An unexpected error occurred. Please try again."; if (error && error.error) { errorMessage = error.error; } else if (error && error.message) { errorMessage = error.message; } else if (typeof error === 'string') { errorMessage = error; } $messageDiv.html(`<div class="p-4 bg-red-600/20 border border-red-500 rounded-lg text-red-300 text-sm"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline -mt-1 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>Reservation failed: ${errorMessage}</div>`); $buttonText.text('Request Reservation'); $buttonSpinner.addClass('hidden'); $submitButton.prop('disabled', false).removeClass('opacity-75 cursor-not-allowed'); });
    });

    // --- Initial Setup ---
    console.log("[Initial Setup] Applying initial highlight based on state:", highlightedDate);
    applyCalendarHighlight(highlightedDate); // Apply initial highlight (will log)
    setTimeout(() => {
         console.log("--- Triggering Initial Change ---");
         $dateInput.trigger('change'); // Trigger initial change (will log)
    }, 100);

}); // End of document ready