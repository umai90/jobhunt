// Runs every 30 min via Android WorkManager — even when app is closed
addEventListener('jobSearch', async (resolve, reject, args) => {
  try {
    const query = args.query || 'developer';
    const res = await fetch(
      `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=15`
    );
    const data = await res.json();
    const jobs = data.jobs || [];
    const currentIds = jobs.map(j => String(j.id));
    const lastIds = args.lastIds || [];

    const newJobs = jobs.filter(j => !lastIds.includes(String(j.id)));

    if (newJobs.length > 0 && lastIds.length > 0) {
      const preview = newJobs
        .slice(0, 2)
        .map(j => `${j.title} @ ${j.company_name}`)
        .join(' • ');

      CapacitorNotifications.schedule([{
        id: Math.floor(Math.random() * 2000000),
        title: `🔍 ${newJobs.length} New Job${newJobs.length > 1 ? 's' : ''} Found!`,
        body: preview,
      }]);
    }

    resolve({ lastIds: currentIds });
  } catch (e) {
    reject(e.message);
  }
});
