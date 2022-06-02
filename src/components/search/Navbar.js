import './Navbar.scss'
import { IoLocationSharp } from 'react-icons/io5'
import { BsGithub, BsSearch } from 'react-icons/bs'
import { WiDaySunnyOvercast } from 'react-icons/wi'

const Navbar = () => {
  return (
    <nav className='navbar'>
      <a href="https://mskorus.pl/" className='logo'>
        <u>YET ANOTHER</u><br/>WEATHER APP
      </a>
      <form className='search-container'>
        <div className='location-icon-container' >
          <IoLocationSharp className='location-icon' />
        </div>
        <input type='text' placeholder='e.g. Edinburgh' className='search-input'/>
        <button type='submit' className='search-button'><BsSearch /></button>
      </form>
      <div className='git'>
        <a href="https://mskorus.pl/" className='git-a'>GitHub</a><BsGithub className='git-icon' />
      </div>
    </nav> 
  )
}

export default Navbar