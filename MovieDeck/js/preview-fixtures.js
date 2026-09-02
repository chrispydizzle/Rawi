(function (global) {
  'use strict';

  global.RawiPreviewFixtures = {
    storybook: {
      user: { Id: 'preview-user', Name: 'Parent' },
      libraries: [
        { Id: 'pixar', Name: 'Disney Pixar' },
        { Id: 'songs', Name: 'Sing & Dance' },
        { Id: 'lessons', Name: 'Little Lessons' }
      ],
      groups: [
        {
          id: 'pixar',
          name: 'Disney Pixar',
          videos: [
            {
              Id: 'bluey',
              Name: "Bluey's Big Adventure",
              ProductionYear: 2024,
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
        }
      ]
    }
  };
}(window));
