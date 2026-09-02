(function (global) {
  'use strict';

  global.RawiPreviewFixtures = {
    storybook: {
      user: { Id: 'preview-user', Name: 'Parent' },
      preferences: {
        version: 2,
        enabled: true,
        lastMode: 'storybook',
        childName: 'Nova',
        libraryIds: ['pixar', 'songs', 'lessons'],
        favoriteItemIds: ['dance', 'colors'],
        reducedMotion: false
      },
      libraries: [
        { Id: 'pixar', Name: 'Disney Pixar' },
        { Id: 'songs', Name: 'Sing & Dance' },
        { Id: 'lessons', Name: 'Little Lessons' },
        { Id: 'grownups', Name: 'Grownups' }
      ],
      resume: [
        {
          Id: 'bluey',
          Name: "Bluey's Big Adventure",
          Overview: 'Bluey follows a moonlit map through the backyard.',
          PreviewBackdropUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='%23172543'/><circle cx='6.2' cy='1.8' r='1.2' fill='%23f2cf7c'/></svg>",
          PreviewImageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='%23657db9'/><rect x='1' y='4.2' width='6' height='2.2' fill='%23fff8df'/></svg>",
          RunTimeTicks: 16800000000,
          UserData: { PlaybackPositionTicks: 3600000000, PlayedPercentage: 21 }
        }
      ],
      groups: [
        {
          id: 'pixar',
          name: 'Disney Pixar',
          videos: [
            {
              Id: 'bluey',
              Name: "Bluey's Big Adventure",
              Overview: 'Bluey follows a moonlit map through the backyard.',
              PreviewBackdropUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='%23172543'/><circle cx='6.2' cy='1.8' r='1.2' fill='%23f2cf7c'/></svg>",
              PreviewImageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='%23657db9'/><rect x='1' y='4.2' width='6' height='2.2' fill='%23fff8df'/></svg>",
              RunTimeTicks: 16800000000,
              UserData: { PlaybackPositionTicks: 3600000000, PlayedPercentage: 21 }
            }
          ]
        },
        {
          id: 'songs',
          name: 'Sing & Dance',
          videos: [{ Id: 'dance', Name: 'Dance With Me', RunTimeTicks: 7200000000 }]
        },
        {
          id: 'lessons',
          name: 'Little Lessons',
          videos: [{ Id: 'colors', Name: 'The Color Garden', RunTimeTicks: 5400000000 }]
        },
        {
          id: 'grownups',
          name: 'Grownups',
          videos: [{ Id: 'late', Name: 'Late Night Movie', RunTimeTicks: 9600000000 }]
        }
      ]
    }
  };
}(window));
