import { buildNavigation } from './build-navigation.js'

function mockRequest(options) {
  return { ...options }
}

describe('#buildNavigation', () => {
  test('Should provide expected navigation details', () => {
    expect(
      buildNavigation(mockRequest({ path: '/non-existent-path' }))
    ).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should provide expected highlighted navigation details', () => {
    expect(buildNavigation(mockRequest({ path: '/' }))).toEqual([
      {
        current: true,
        text: 'Home',
        href: '/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should prefix links with the forwarded prefix', () => {
    expect(
      buildNavigation(
        mockRequest({
          path: '/about',
          headers: { 'x-forwarded-prefix': '/submit-packaging' }
        })
      )
    ).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/submit-packaging/'
      },
      {
        current: true,
        text: 'About',
        href: '/submit-packaging/about'
      }
    ])
  })
})
