$(document).ready(function() {
    // --- Global Variables & References ---
    const today = moment().format('YYYY-MM-DD');
    const maxDate = moment().add(3, 'months').format('YYYY-MM-DD'); // Allow booking 3 months ahead
    const $dateInput = $('#date');
    const $partySizeSelect = $('#numberOfPeople');
    const $timeSelect = $('#time');
    const $timeLoader = $('#time-loader');
    const $reservationForm = $('#reservationForm');
    const $messageDiv = $('#reservationMessage');
    const $submitButton = $('#submitButton');
    const $buttonText = $('#buttonText');
    const $buttonSpinner = $('#buttonSpinner');
    const restaurantPhoneNumber = '(703) 555-1234'; // Store phone number

    // --- Calendar Initialization ---
    $('#calendar').fullCalendar({
        header: { left: 'prev', center: 'title', right: 'next' },
        defaultDate: today,
        navLinks: false,
        editable: false,
        eventLimit: true,
        selectable: true,
        selectHelper: true,
        validRange: { start: today, end: maxDate },
        dayRender: function (date, cell) {
            if (date.isBefore(moment().startOf('day'))) {
                cell.addClass('fc-past');
            }
        },
        dayClick: function(date, jsEvent, view) {
             if (date.isBefore(moment().startOf('day'))) { return; }
            const selectedDate = date.format('YYYY-MM-DD');
            if ($dateInput.val() !== selectedDate) {
                $dateInput.val(selectedDate).trigger('change');
            } else {
                 $('.fc-day').removeClass('fc-day-selected-highlight');
                 $(this).addClass('fc-day-selected-highlight');
            }
        },
    });

    $dateInput.attr('min', today);
    $dateInput.attr('value', today);
    $dateInput.attr('max', maxDate);

    // --- Function to Fetch Available Times ---
    function fetchAvailableTimes(selectedDate, partySize) {
        $timeSelect.html('<option value="" disabled selected>Select date & guests first</option>').prop('disabled', true);
        $messageDiv.html('');

        if (!selectedDate || !partySize) { return; }

        console.log(`Fetching times for ${selectedDate}, party size ${partySize}`);
        $timeLoader.removeClass('hidden').addClass('flex');
        $timeSelect.prop('disabled', true);

        fetch(`/availability?date=${selectedDate}&partySize=${partySize}`)
            .then(response => {
                $timeLoader.addClass('hidden').removeClass('flex');
                if (!response.ok) {
                    return response.json().then(errData => {
                        throw new Error(errData.error || `Server error: ${response.status}`);
                    }).catch(() => {
                        throw new Error(`Network response was not ok: ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log("Availability data received:", data);
                // *** Call the updated function ***
                populateTimeSlotsClientSideCheck(data.slots, partySize);
            })
            .catch(error => {
                console.error('Error fetching times:', error);
                $timeSelect.empty().append('<option value="" disabled selected>Error loading times</option>').prop('disabled', true);
                $messageDiv.html(`<span class="text-red-400 text-sm">Could not load times: ${error.message}. Please try again or call us.</span>`);
            });
    }

    // --- MODIFIED Function to Populate Time Slot Dropdown with Client-Side Past Check ---
    function populateTimeSlotsClientSideCheck(slots, requestedPartySize) {
        $timeSelect.empty();
        let availableSlotsFound = false;
        const nowClient = moment(); // Get client's current time

        if (!slots || slots.length === 0) {
             $timeSelect.append('<option value="" disabled selected>No times available</option>');
             $messageDiv.html(`<span class="text-secondary-light text-sm">Sorry, no online reservations are available for ${requestedPartySize} guest(s) on this date. Please try another date or call us at <a href="tel:${restaurantPhoneNumber}" class="underline hover:text-primary">${restaurantPhoneNumber}</a>.</span>`);
             $timeSelect.prop('disabled', true);
             return;
        }

        $timeSelect.append('<option value="" disabled selected>Select an available time</option>');

        slots.forEach(slot => {
            const option = $('<option></option>');
            option.val(slot.time); // e.g., "17:30"
            let displayText = slot.displayTime; // e.g., "5:30 PM"
            let isDisabled = false;
            let isPast = false;

            // *** Client-Side Past Check ***
            const slotDateTime = moment(slot.slotIsoString); // Parse the ISO string from server
            if (slotDateTime.isBefore(nowClient)) {
                isPast = true;
                isDisabled = true;
                displayText += ' (Past)';
                option.addClass('unavailable'); // Apply unavailable styling
            }
            // *** End Client-Side Past Check ***

            // If not past, check status from server
            if (!isPast) {
                switch(slot.status) {
                    case 'available':
                        availableSlotsFound = true;
                        // displayText += ` (${slot.availableSeats} seats)`; // Optional: Show seats
                        break;
                    case 'limited':
                         // Still potentially available, but show limited seats
                        availableSlotsFound = true; // Treat as available for selection if needed
                        displayText += ` (Only ${slot.availableSeats} seat${slot.availableSeats > 1 ? 's' : ''} left)`;
                        // Decide if 'limited' should be selectable or not. If not:
                        // isDisabled = true;
                        // option.addClass('unavailable');
                        break;
                    case 'full':
                        displayText += ' (Booked)';
                        isDisabled = true;
                        option.addClass('unavailable');
                        break;
                    // NOTE: No 'past' case needed here, handled above
                    default: // 'unknown' or other cases
                         displayText += ' (Unavailable)';
                         isDisabled = true;
                         option.addClass('unavailable');
                }
            }

            option.text(displayText);
            option.prop('disabled', isDisabled); // Set disabled based on checks
            $timeSelect.append(option);
        });

        if (!availableSlotsFound) {
             $timeSelect.find('option:not([disabled])').remove();
             $timeSelect.prepend('<option value="" disabled selected>No suitable times available</option>');
             $messageDiv.html(`<span class="text-secondary-light text-sm">Sorry, we don't have availability for ${requestedPartySize} guest(s) at any time on this date. Please try another date or call us at <a href="tel:${restaurantPhoneNumber}" class="underline hover:text-primary">${restaurantPhoneNumber}</a>.</span>`);
             $timeSelect.prop('disabled', true);
        } else {
             $timeSelect.prop('disabled', false);
        }
    }

    // --- Event Listeners for Date and Party Size Changes ---
    $dateInput.add($partySizeSelect).on('change', function() {
        const selectedDate = $dateInput.val();
        const partySize = $partySizeSelect.val();

        if (selectedDate) {
             $('.fc-day').removeClass('fc-day-selected-highlight');
             $(`.fc-day[data-date="${selectedDate}"]`).addClass('fc-day-selected-highlight');
        }
        fetchAvailableTimes(selectedDate, partySize); // Calls the function that now uses the client-side check version
    });

    // --- Form Submission Logic (Unchanged) ---
    $reservationForm.submit(function (e) {
        e.preventDefault();

        let isValid = true;
        $('.text-red-400.text-xs').text('');
        $messageDiv.html('');

        if (!$('#name').val()) { $('#name-error').text('Name is required.'); isValid = false; }
        if (!$('#email').val() || !/^\S+@\S+\.\S+$/.test($('#email').val())) {
            $('#email-error').text('Valid email is required.'); isValid = false;
        }
        if (!$partySizeSelect.val()) { $('#people-error').text('Party size is required.'); isValid = false; }
        if (!$dateInput.val()) { $('#date-error').text('Date is required.'); isValid = false; }
        if (!$timeSelect.val() || $timeSelect.find('option:selected').prop('disabled')) {
             $('#time-error').text('Please select an available time slot.'); isValid = false;
        }

        if (!isValid) {
            $messageDiv.html('<span class="text-red-400 text-sm">Please correct the errors above.</span>');
            $('.text-red-400.text-xs').not(':empty').first().prev('input, select, textarea').focus();
            return;
        }

        $messageDiv.html('');
        $buttonText.text('Sending Request...');
        $buttonSpinner.removeClass('hidden');
        $submitButton.prop('disabled', true).addClass('opacity-75 cursor-not-allowed');

        const formData = {
            name: $('#name').val(),
            email: $('#email').val(),
            numberOfPeople: $partySizeSelect.val(),
            date: $dateInput.val(),
            time: $timeSelect.val(),
            specialRequests: $('#specialRequests').val() || '',
        };

        console.log("Submitting data:", formData);

        fetch('/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                 return response.json().then(err => { throw err; }).catch(() => {
                     throw new Error(`Server responded with status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Success Response:', data);
            $messageDiv.html(`
                <div class="p-4 bg-green-600/20 border border-green-500 rounded-lg text-green-300 text-sm">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline -mt-1 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
                    ${data.message || 'Request sent! Please check your email to verify.'}
                 </div>
            `);
            $reservationForm[0].reset();
            $timeSelect.html('<option value="" disabled selected>Select date & guests first</option>').prop('disabled', true);
             $messageDiv.append('<div class="mt-2 text-xs text-neutral-light/70">Form reset. Select details for a new reservation.</div>');
            $('.fc-day').removeClass('fc-day-selected-highlight');

            setTimeout(() => {
                 $buttonText.text('Request Reservation');
                 $buttonSpinner.addClass('hidden');
                $submitButton.prop('disabled', false).removeClass('opacity-75 cursor-not-allowed');
            }, 1000);
         })
        .catch(error => {
            console.error('Error during fetch:', error);
            let errorMessage = "An unexpected error occurred. Please try again.";
            if (error && error.error) { errorMessage = error.error; }
            else if (error && error.message) { errorMessage = error.message; }
            else if (typeof error === 'string') { errorMessage = error; }

            $messageDiv.html(`
                <div class="p-4 bg-red-600/20 border border-red-500 rounded-lg text-red-300 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline -mt-1 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>
                     Reservation failed: ${errorMessage}
                </div>
             `);

             $buttonText.text('Request Reservation');
             $buttonSpinner.addClass('hidden');
            $submitButton.prop('disabled', false).removeClass('opacity-75 cursor-not-allowed');
         });

    }); // End of form submit handler

    // --- Initial check if date/party size are pre-filled ---
    if ($dateInput.val() && $partySizeSelect.val()) {
        fetchAvailableTimes($dateInput.val(), $partySizeSelect.val());
        // Initial calendar highlight
        $('.fc-day').removeClass('fc-day-selected-highlight');
        $(`.fc-day[data-date="${$dateInput.val()}"]`).addClass('fc-day-selected-highlight');
    }


}); // End of document ready