$(document).ready(function() {
  $('#calendar').fullCalendar({
    header: {
      left: 'prev,next today',
      center: 'title',
      right: 'month,agendaWeek,agendaDay'
    },
    defaultDate: moment().format('YYYY-MM-DD'),
    navLinks: true,
    editable: false,
    eventLimit: true,
    events: [
      {
        title: 'Fully Booked',
        start: moment().add(1, 'days').format('YYYY-MM-DD'),
        color: '#FF0000'
      },
      {
        title: 'Available',
        start: moment().add(2, 'days').format('YYYY-MM-DD'),
        color: '#28A745'
      }
    ]
  });

  $('#reservationForm').on('submit', function(e) {
    e.preventDefault();

    const formData = {
      name: $('#name').val(),
      email: $('#email').val(),
      date: $('#date').val(),
      time: $('#time').val(),
      numberOfPeople: $('#numberOfPeople').val()
    };

    $.ajax({
      url: '/reserve',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(formData),
      success: function(response) {
        $('#reservationMessage').html('<div class="alert alert-success">Reservation confirmed! ID: ' + response.reservation.id + '</div>');
      },
      error: function(err) {
        $('#reservationMessage').html('<div class="alert alert-danger">Error: ' + err.responseJSON.error + '</div>');
      }
    });
  });
});
