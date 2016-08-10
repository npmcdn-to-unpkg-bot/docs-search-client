import * as React from 'react';
import { ISearchState, ISearchAction, getSearchResult } from '../../redux/reducers/searchdocs';
import { Link } from 'react-router';
const { connect } = require('react-redux');

interface ISearchProps {
  searchState: ISearchState;
  getSearchResult: Redux.ActionCreator<ISearchAction>;
}

@connect(
  state => ({
    searchState: state.searchState,
  }),
  dispatch => ({
    getSearchResult: (input: string) => dispatch(getSearchResult(dispatch, input)),
  })
)

class Header extends React.Component<any, void> {

  private handleChange(event) {
    let input = event.target.value;
    this.props.getSearchResult(input);
  }
  public render() {
    const s = require('./style.css');
    return (
      <div className={s.content}>
        <form  className={s.left} role="search">
          <input type="search" onChange={this.handleChange.bind(this) }/>
          <button type="reset" >Clear search</button>
          <div></div>
        </form>
        <div className={s.right}>
          <Link className={s.rightA} to= "/" >docs</Link>
          <Link className={s.rightA} to= "about" >about</Link>
          <Link className={s.rightA} to= "counter" >counter</Link>
          <Link className={s.rightA} to= "stars" >stars</Link>
        </div>
      </div>
    );
  }
}

export { Header }
