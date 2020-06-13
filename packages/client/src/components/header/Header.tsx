import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import { Link } from "react-router-dom";

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1
  },
  menuButton: {
    marginRight: theme.spacing(2)
  },
  title: {
    flexGrow: 1
  }
}));

interface HeaderProps {
  leftComponent?: any;
  rightComponent?: any;
}

const Header: React.FC<HeaderProps> = ({ leftComponent, rightComponent }) => {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <AppBar position="static">
        <Toolbar>
          {leftComponent}
          <Typography variant="subtitle1" className={classes.title}>
            <Link to="/" style={{ color: 'inherit', textDecoration: "none" }}>
              Balanced Work Life
            </Link>
          </Typography>
          <Typography variant="caption" className={classes.title}>
            v{process.env.REACT_APP_VERSION}
          </Typography>
          {rightComponent}
        </Toolbar>
      </AppBar>
    </div>
  );
};

export default Header;