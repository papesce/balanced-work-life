import React, { Component } from 'react'
import Header from './Header';
import Button from '@material-ui/core/Button';

interface InitialHeaderProps {
  handleLogout:  () => void;
}

export default class InitialHeader extends Component<InitialHeaderProps> {
    
    render() {
        const { handleLogout } = this.props;
        const rightComponent =  <Button onClick={handleLogout} color="inherit">Logout</Button>;
        return (
            <Header rightComponent={rightComponent}></Header>
        )
    }
}