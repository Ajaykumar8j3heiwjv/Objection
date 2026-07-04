document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.pa-phase-head').forEach(function(head, idx){
    head.addEventListener('click', function(){
      const phase = head.closest('.pa-phase');
      phase.classList.toggle('open');
    });
  });
  // open the first phase by default
  const firstPhase = document.querySelector('.pa-phase');
  if(firstPhase) firstPhase.classList.add('open');
});
