import './base.css'
import './sign-in.css'

// No accounts in the prototype: only a guest gets in. The device picks the view without asking, the reviewer's on a
// phone and the manager's anywhere else; the demo reads it from `as` once those screens exist (#80, #82).
const guest = document.querySelector<HTMLButtonElement>('.signin-guest')
if (!guest) throw new Error('Missing the "Sign in as Guest" button')
guest.addEventListener('click', () => {
  const phone = matchMedia('(pointer: coarse)').matches || innerWidth < 768
  location.assign(`/demo/?as=${phone ? 'reviewer' : 'manager'}`)
})
